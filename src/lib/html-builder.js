import { escapeHtml, escapeAttr } from "./html-escape.js";

/**
 * @typedef {Object} AttachmentEntry
 * @property {string} originalName
 * @property {string|null} relativePath  relative path if exported, null if skipped
 * @property {boolean} exported
 */

/**
 * @typedef {Object} HtmlInput
 * @property {Record<string,string>} headers  header name -> already-joined display value
 * @property {string} bodyHtml  body HTML, cid refs already rewritten; embedded as-is
 * @property {AttachmentEntry[]} attachments
 */

/** Preferred header display order; any remaining headers follow alphabetically. */
const HEADER_ORDER = ["subject", "from", "to", "cc", "bcc", "reply-to", "date", "message-id"];

/**
 * Build a self-contained HTML document string for one exported email.
 * @param {HtmlInput} input
 * @returns {string}
 */
export function buildHtmlDocument(input) {
  const { headers = {}, bodyHtml = "", attachments = [] } = input;

  const keys = Object.keys(headers);
  const ordered = [
    ...HEADER_ORDER.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !HEADER_ORDER.includes(k)).sort(),
  ];

  const headerRows = ordered
    .map(
      (k) =>
        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(headers[k])}</td></tr>`,
    )
    .join("\n");

  const attachmentItems = attachments
    .map((a) => {
      if (a.exported && a.relativePath) {
        return `<li><a href="${escapeAttr(a.relativePath)}">${escapeHtml(a.originalName)}</a></li>`;
      }
      return `<li>${escapeHtml(a.originalName)} <em>(export edilmedi — tür desteklenmiyor / not exported)</em></li>`;
    })
    .join("\n");

  const attachmentSection = attachments.length
    ? `<hr>\n<h2>Ekler / Attachments</h2>\n<ul class="attachments">\n${attachmentItems}\n</ul>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="generator" content="thunderbird-email-html-export">
<style>
body { font-family: sans-serif; margin: 1rem; }
table.headers { border-collapse: collapse; margin-bottom: 1rem; }
table.headers th { text-align: left; padding: 2px 8px; vertical-align: top; white-space: nowrap; }
table.headers td { padding: 2px 8px; }
.email-body { border-top: 1px solid #ccc; padding-top: 1rem; }
</style>
</head>
<body>
<table class="headers">
${headerRows}
</table>
<div class="email-body">
${bodyHtml}
</div>
${attachmentSection}
</body>
</html>`;
}
