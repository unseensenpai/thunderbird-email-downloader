import { uuidv7 } from "./lib/uuidv7.js";
import { resolveAttachment } from "./lib/attachment-filter.js";
import { attachmentFilename, htmlFilename } from "./lib/filename.js";
import { rewriteCidReferences } from "./lib/cid-rewrite.js";
import { buildHtmlDocument } from "./lib/html-builder.js";
import { escapeHtml } from "./lib/html-escape.js";

const MENU_ID = "export-emails-html";

browser.menus.create({
  id: MENU_ID,
  title: "HTML olarak dışa aktar",
  contexts: ["message_list"],
});

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const messages = info.selectedMessages?.messages ?? [];
  if (messages.length === 0) return;
  await runExport(messages);
});

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

async function runExport(messages) {
  const targetDir = await browser.FileExport.pickFolder("Dışa aktarma klasörünü seçin");
  if (!targetDir) return; // user cancelled

  const attachmentsDir = await browser.FileExport.joinPath(targetDir, ["attachments"]);
  await browser.FileExport.makeDir(attachmentsDir);

  let emailCount = 0;
  let attachmentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const msg of messages) {
    try {
      const messageUuid = uuidv7(); // one UUID per email, used for its .html file
      const full = await browser.messages.getFull(msg.id);
      const displayHeaders = buildDisplayHeaders(full.headers);

      const bodies = collectBodies(full, { html: null, plain: null });
      let bodyHtml;
      if (bodies.html !== null) {
        bodyHtml = bodies.html;
      } else {
        // plain-only: escape and wrap in <pre>.
        bodyHtml = `<pre>${escapeHtml(bodies.plain ?? "")}</pre>`;
      }

      const rawAttachments = await browser.messages.listAttachments(msg.id);
      const cidToPath = new Map();
      const attachmentEntries = [];
      const filesToWrite = [];

      for (const att of rawAttachments) {
        const decision = resolveAttachment({ name: att.name, contentType: att.contentType });
        if (!decision.exported) {
          skippedCount++;
          attachmentEntries.push({ originalName: att.name, relativePath: null, exported: false });
          continue;
        }
        const uuid = uuidv7();
        const fname = attachmentFilename(uuid, decision.extension);
        const relativePath = `attachments/${fname}`;
        const absPath = await browser.FileExport.joinPath(attachmentsDir, [fname]);

        const file = await browser.messages.getAttachmentFile(msg.id, att.partName);
        const buffer = await file.arrayBuffer();
        const byteArray = Array.from(new Uint8Array(buffer));
        filesToWrite.push({ absPath, byteArray });

        if (att.contentId) {
          const bareId = att.contentId.replace(/^<|>$/g, "");
          cidToPath.set(bareId, relativePath);
        }
        attachmentEntries.push({ originalName: att.name, relativePath, exported: true });
        attachmentCount++;
      }

      const rewrittenBody = rewriteCidReferences(bodyHtml, cidToPath);
      const htmlDoc = buildHtmlDocument({
        headers: displayHeaders,
        bodyHtml: rewrittenBody,
        attachments: attachmentEntries,
      });

      // Persist attachment bytes first, then the HTML.
      for (const f of filesToWrite) {
        await browser.FileExport.writeBytes(f.absPath, f.byteArray);
      }
      const htmlAbs = await browser.FileExport.joinPath(targetDir, [htmlFilename(messageUuid)]);
      await browser.FileExport.writeText(htmlAbs, htmlDoc);

      emailCount++;
    } catch (err) {
      errorCount++;
      console.error("Export failed for message", msg.id, err);
    }
  }

  await browser.notifications.create({
    type: "basic",
    title: "Dışa aktarma tamamlandı",
    message:
      `${emailCount} e-posta, ${attachmentCount} ek dışa aktarıldı. ` +
      `${skippedCount} ek atlandı. ${errorCount} hata.\nKlasör: ${targetDir}`,
  });
}
