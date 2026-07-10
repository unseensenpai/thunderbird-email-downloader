import { uuidv7 } from "./lib/uuidv7.js";
import { resolveAttachment } from "./lib/attachment-filter.js";
import { attachmentFilename, htmlFilename } from "./lib/filename.js";
import { rewriteCidReferences } from "./lib/cid-rewrite.js";
import { buildHtmlDocument } from "./lib/html-builder.js";
import { escapeHtml } from "./lib/html-escape.js";
import { messageKey } from "./lib/message-key.js";
import {
  INDEX_FILENAME,
  parseIndex,
  serializeIndex,
  upsertEntry,
} from "./lib/export-index.js";
import { buildDuplicatePlan } from "./lib/duplicate-plan.js";

const MENU_ID = "export-emails-html";

// The MV3 background is an event page: it is re-evaluated every time it wakes,
// so the menu may already exist. Consuming lastError in the callback keeps that
// expected case from surfacing as an unchecked-error warning.
browser.menus.create(
  {
    id: MENU_ID,
    title: "HTML olarak dışa aktar",
    contexts: ["message_list"],
  },
  () => void browser.runtime.lastError
);

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const messages = info.selectedMessages?.messages ?? [];
  if (messages.length === 0) return;

  // Without this guard a throw here becomes an unhandled rejection and the
  // user sees nothing at all.
  try {
    await runExport(messages);
  } catch (err) {
    console.error("Export failed", err);
    await notify("Dışa aktarma başarısız", String(err?.message ?? err));
  }
});

/** Show a basic notification. */
async function notify(title, message) {
  await browser.notifications.create({ type: "basic", title, message });
}

/**
 * Recursively collect the first text/html and text/plain body parts.
 * @param {object} part MessagePart from messages.getFull
 * @param {{html: string|null, plain: string|null}} acc
 */
function collectBodies(part, acc) {
  if (!part) return acc;
  const ct = (part.contentType || "").toLowerCase();
  if (ct.startsWith("text/html") && acc.html === null && typeof part.body === "string") {
    acc.html = part.body;
  } else if (ct.startsWith("text/plain") && acc.plain === null && typeof part.body === "string") {
    acc.plain = part.body;
  }
  for (const child of part.parts || []) collectBodies(child, acc);
  return acc;
}

/** Join a header dictionary value (array of strings) into one display string. */
function headerValue(headers, key) {
  const v = headers?.[key];
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** Build the display headers object the html-builder expects. */
function buildDisplayHeaders(headers) {
  const out = {};
  for (const key of Object.keys(headers || {})) {
    const val = headerValue(headers, key);
    if (val !== undefined) out[key] = val;
  }
  return out;
}

/**
 * Export one message. Returns the index entry describing what was written.
 * `forcedHtmlName` reuses the existing html filename when overwriting.
 * @returns {Promise<{entry: object, attachmentCount: number, skipped: number}>}
 */
async function exportOneMessage(msg, targetDir, attachmentsDir, forcedHtmlName) {
  const full = await browser.messages.getFull(msg.id);
  const displayHeaders = buildDisplayHeaders(full.headers);

  const bodies = collectBodies(full, { html: null, plain: null });
  const bodyHtml =
    bodies.html !== null ? bodies.html : `<pre>${escapeHtml(bodies.plain ?? "")}</pre>`;

  const rawAttachments = await browser.messages.listAttachments(msg.id);
  const cidToPath = new Map();
  const attachmentEntries = [];
  const filesToWrite = [];
  const writtenAttachments = [];
  let skipped = 0;

  for (const att of rawAttachments) {
    const decision = resolveAttachment({ name: att.name, contentType: att.contentType });
    if (!decision.exported) {
      skipped++;
      attachmentEntries.push({ originalName: att.name, relativePath: null, exported: false });
      continue;
    }
    const uuid = uuidv7();
    const fname = attachmentFilename(uuid, decision.extension);
    const relativePath = `attachments/${fname}`;
    const absPath = await browser.FileExport.joinPath(attachmentsDir, [fname]);

    const file = await browser.messages.getAttachmentFile(msg.id, att.partName);
    const buffer = await file.arrayBuffer();
    filesToWrite.push({ absPath, byteArray: Array.from(new Uint8Array(buffer)) });

    if (att.contentId) {
      cidToPath.set(att.contentId.replace(/^<|>$/g, ""), relativePath);
    }
    attachmentEntries.push({ originalName: att.name, relativePath, exported: true });
    writtenAttachments.push(relativePath);
  }

  const htmlDoc = buildHtmlDocument({
    headers: displayHeaders,
    bodyHtml: rewriteCidReferences(bodyHtml, cidToPath),
    attachments: attachmentEntries,
  });

  // Write new files first; stale deletion happens only after this succeeds.
  for (const f of filesToWrite) {
    await browser.FileExport.writeBytes(f.absPath, f.byteArray);
  }
  const htmlName = forcedHtmlName ?? htmlFilename(uuidv7());
  const htmlAbs = await browser.FileExport.joinPath(targetDir, [htmlName]);
  await browser.FileExport.writeText(htmlAbs, htmlDoc);

  return {
    entry: {
      html: htmlName,
      attachments: writtenAttachments,
      exportedAt: new Date().toISOString(),
      subject: msg.subject ?? "",
    },
    attachmentCount: writtenAttachments.length,
    skipped,
  };
}

async function runExport(messages) {
  const targetDir = await browser.FileExport.pickFolder("Dışa aktarma klasörünü seçin");
  if (!targetDir) return; // user cancelled

  const indexAbs = await browser.FileExport.joinPath(targetDir, [INDEX_FILENAME]);
  // A malformed index throws here and aborts before anything is written.
  let index = parseIndex(await browser.FileExport.readTextIfExists(indexAbs));

  const keyed = [];
  for (const message of messages) {
    keyed.push({ key: await messageKey(message), message });
  }
  const plan = buildDuplicatePlan(keyed, index);

  let decision = "skip";
  if (plan.duplicates.length > 0) {
    // A throw here propagates to the menu listener's catch: nothing is written.
    // Defaulting to "overwrite" on a dialog failure would destroy files.
    decision = await browser.FileExport.confirmDuplicates(plan.total, plan.duplicates.length);
    if (decision === "cancel") return;
  }

  const work = [
    ...plan.fresh.map((f) => ({ message: f.message, key: f.key, forcedHtmlName: null, stale: [] })),
    ...(decision === "overwrite"
      ? plan.duplicates.map((d) => ({
          message: d.message,
          key: d.key,
          forcedHtmlName: d.existingHtml,
          stale: d.staleAttachments,
        }))
      : []),
  ];

  const attachmentsDir = await browser.FileExport.joinPath(targetDir, ["attachments"]);
  await browser.FileExport.makeDir(attachmentsDir);

  let emailCount = 0;
  let attachmentCount = 0;
  let skippedAttachments = 0;
  let errorCount = 0;
  let deleteFailures = 0;

  for (const item of work) {
    try {
      const result = await exportOneMessage(
        item.message,
        targetDir,
        attachmentsDir,
        item.forcedHtmlName
      );

      // Only now that the new files exist do we remove the superseded ones.
      for (const rel of item.stale) {
        try {
          const abs = await browser.FileExport.joinPath(targetDir, rel.split("/"));
          await browser.FileExport.deleteFile(abs);
        } catch (err) {
          // Files are already correct on disk; a failed cleanup is not a failed export.
          deleteFailures++;
          console.error("Stale attachment delete failed", rel, err);
        }
      }

      index = upsertEntry(index, item.key, result.entry);
      emailCount++;
      attachmentCount += result.attachmentCount;
      skippedAttachments += result.skipped;
    } catch (err) {
      // A failed message is never recorded in the index.
      errorCount++;
      console.error("Export failed for message", item.message.id, err);
    }
  }

  let indexWarning = "";
  try {
    await browser.FileExport.writeText(indexAbs, serializeIndex(index));
  } catch (err) {
    console.error("Index write failed", err);
    indexWarning =
      "\nUYARI: Index yazılamadı; bu e-postalar bir dahaki sefere mükerrer görünmeyecek.";
  }

  const duplicateNote =
    plan.duplicates.length === 0
      ? ""
      : decision === "skip"
        ? ` ${plan.duplicates.length} zaten mevcuttu (atlandı).`
        : ` ${plan.duplicates.length} üzerine yazıldı.`;
  const deleteNote = deleteFailures > 0 ? ` ${deleteFailures} eski ek silinemedi.` : "";

  await notify(
    "Dışa aktarma tamamlandı",
    `${emailCount} e-posta, ${attachmentCount} ek dışa aktarıldı.${duplicateNote}` +
      ` ${skippedAttachments} ek atlandı. ${errorCount} hata.${deleteNote}\nKlasör: ${targetDir}` +
      indexWarning
  );
}
