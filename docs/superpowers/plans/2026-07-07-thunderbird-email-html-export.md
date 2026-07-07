# Thunderbird Email HTML Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Thunderbird MV3 MailExtension that exports selected emails to a user-chosen folder as `<uuidv7>.html` files, with attachments written to an `attachments/` subfolder and referenced relatively from the HTML.

**Architecture:** A standard (unprivileged) WebExtension layer reads messages/attachments and builds HTML + filenames using pure, unit-tested functions. A minimal Experiment API layer does only two privileged things: open a real `nsIFilePicker` folder chooser and write files to disk via `IOUtils`/`PathUtils`. The pure logic lives in plain ES modules testable with Node's built-in test runner; the Thunderbird-facing glue is verified manually with `web-ext run`.

**Tech Stack:** JavaScript (ES modules), Thunderbird 128+ WebExtension APIs (MV3), Experiment API (`Cc`/`Ci`/`nsIFilePicker`, `IOUtils`, `PathUtils`), Node 21 `node --test` for unit tests, `web-ext` for run/build.

---

## File Structure

```
thunderbird_email_downloader/
├── package.json                       # npm scripts: test, lint, run, build
├── src/
│   ├── manifest.json                  # MV3 manifest + experiment_apis + menus + messagesRead
│   ├── background.js                  # entry: menu setup + orchestration (TB-facing glue)
│   ├── lib/
│   │   ├── uuidv7.js                   # pure: UUIDv7 generator
│   │   ├── attachment-filter.js       # pure: which extensions are exported/skipped
│   │   ├── filename.js                # pure: build <uuid>.<ext>, extract extension
│   │   ├── html-escape.js             # pure: escape text for HTML text nodes/attrs
│   │   ├── cid-rewrite.js             # pure: rewrite cid: refs in body to attachments/ paths
│   │   └── html-builder.js            # pure: assemble the full HTML document string
│   └── api/
│       └── FileExport/
│           ├── schema.json            # experiment API schema (pickFolder, writeText, writeBytes, makeDir)
│           └── implementation.js      # experiment API parent implementation
├── test/
│   ├── uuidv7.test.js
│   ├── attachment-filter.test.js
│   ├── filename.test.js
│   ├── html-escape.test.js
│   ├── cid-rewrite.test.js
│   └── html-builder.test.js
└── icons/
    ├── export-16.png                  # placeholder icons (added in packaging task)
    ├── export-32.png
    └── export-64.png
```

**Data flow at runtime:**
1. User right-clicks selected messages → `menus` fires `onClicked` with `info.selectedMessages`.
2. `background.js` calls `browser.FileExport.pickFolder(...)` (experiment) → absolute folder path (or cancel).
3. For each message: `messages.getFull` (headers + body) and `messages.listAttachments` + `messages.getAttachmentFile` (bytes).
4. Pure `lib/` functions produce the HTML string and the list of `{relativePath, bytes}` files to write.
5. `background.js` calls experiment `makeDir`, `writeBytes`, `writeText` to persist everything.
6. A summary notification is shown.

**Why bytes cross the boundary as a number array:** Experiment API call arguments are structured-cloned across a process boundary and typed arrays are not reliably preserved. The standard layer converts `Uint8Array` → `Array.from(...)` before the call; the experiment reconstructs `new Uint8Array(arr)`. This is explicit in the tasks below.

---

## Task 1: Project scaffolding (package.json + directories)

**Files:**
- Create: `package.json`
- Create: `src/`, `src/lib/`, `src/api/FileExport/`, `test/`, `icons/` (directories, created implicitly by later file writes)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "thunderbird-email-html-export",
  "version": "0.1.0",
  "description": "Export selected Thunderbird emails to a chosen folder as HTML with attachments.",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test",
    "run:tb": "web-ext run --source-dir=src --verbose",
    "build": "web-ext build --source-dir=src --artifacts-dir=web-ext-artifacts --overwrite-dest"
  },
  "devDependencies": {
    "web-ext": "^8.3.0"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install`
Expected: `web-ext` installed under `node_modules`, `package-lock.json` created, exit code 0.

- [ ] **Step 3: Verify the test runner works with an empty test dir**

Run: `node --test`
Expected: exits 0 with "tests 0" (no test files yet is fine; if it errors on missing dir, that's resolved once test files exist in Task 2).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold thunderbird email export project"
```

---

## Task 2: UUIDv7 generator (pure)

**Files:**
- Create: `src/lib/uuidv7.js`
- Test: `test/uuidv7.test.js`

UUIDv7 layout: 48-bit Unix millisecond timestamp, version nibble `7`, variant bits `10`, remaining bits random. We generate it dependency-free using `crypto.getRandomValues` (available in both Node 21 and the extension environment via `globalThis.crypto`).

- [ ] **Step 1: Write the failing test**

```javascript
// test/uuidv7.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { uuidv7 } from "../src/lib/uuidv7.js";

test("uuidv7 matches canonical UUID shape", () => {
  const id = uuidv7();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("uuidv7 has version 7 and RFC4122 variant", () => {
  const id = uuidv7();
  // version nibble is first char of 3rd group
  assert.equal(id[14], "7");
  // variant nibble is first char of 4th group: one of 8,9,a,b
  assert.ok(["8", "9", "a", "b"].includes(id[19]));
});

test("uuidv7 values are time-ordered (lexicographically increase over time)", async () => {
  const a = uuidv7();
  await new Promise((r) => setTimeout(r, 3));
  const b = uuidv7();
  assert.ok(a < b, `${a} should sort before ${b}`);
});

test("uuidv7 produces unique values", () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(uuidv7());
  assert.equal(set.size, 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/uuidv7.test.js`
Expected: FAIL — cannot find module `../src/lib/uuidv7.js`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/uuidv7.js

/**
 * Generate a UUIDv7 (time-ordered) string.
 * Layout: 48-bit ms timestamp | version(7) | 12 rand bits | variant(10) | 62 rand bits.
 * Uses globalThis.crypto.getRandomValues (Node 21 + WebExtension both provide it).
 * @returns {string} canonical lowercase UUID
 */
export function uuidv7() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  const ts = Date.now(); // milliseconds since epoch

  // 48-bit timestamp into bytes 0..5 (big-endian)
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  // version 7 in high nibble of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // RFC 4122 variant (10xxxxxx) in byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20, 32)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/uuidv7.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uuidv7.js test/uuidv7.test.js
git commit -m "feat: add dependency-free UUIDv7 generator"
```

---

## Task 3: Attachment type filter (pure)

**Files:**
- Create: `src/lib/attachment-filter.js`
- Test: `test/attachment-filter.test.js`

Skip archives and executables/scripts; export everything else. Decision is based on the lowercased file extension.

- [ ] **Step 1: Write the failing test**

```javascript
// test/attachment-filter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isExportableFilename, SKIPPED_EXTENSIONS } from "../src/lib/attachment-filter.js";

test("exports common documents and images", () => {
  for (const name of ["teklif.pdf", "photo.PNG", "sheet.xlsx", "notes.txt", "image.jpeg", "data.csv"]) {
    assert.equal(isExportableFilename(name), true, name);
  }
});

test("skips archives and executables regardless of case", () => {
  for (const name of ["backup.zip", "data.RAR", "setup.exe", "run.BAT", "lib.dll", "a.7z", "s.vbs", "x.js"]) {
    assert.equal(isExportableFilename(name), false, name);
  }
});

test("files with no extension are skipped (unknown type)", () => {
  assert.equal(isExportableFilename("README"), false);
});

test("SKIPPED_EXTENSIONS contains the documented set", () => {
  for (const ext of ["zip", "rar", "7z", "tar", "gz", "exe", "msi", "bat", "cmd", "com", "scr", "dll", "js", "vbs"]) {
    assert.ok(SKIPPED_EXTENSIONS.has(ext), ext);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/attachment-filter.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/attachment-filter.js

/** Extensions that are never exported (archives, executables, scripts). */
export const SKIPPED_EXTENSIONS = new Set([
  "zip", "rar", "7z", "tar", "gz",
  "exe", "msi", "bat", "cmd", "com", "scr", "dll", "js", "vbs",
]);

/**
 * Return the lowercased extension of a filename without the dot, or "" if none.
 * @param {string} name
 * @returns {string}
 */
export function extensionOf(name) {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

/**
 * True if an attachment with this filename should be exported.
 * Files with no extension are treated as unknown and skipped.
 * @param {string} name
 * @returns {boolean}
 */
export function isExportableFilename(name) {
  const ext = extensionOf(name);
  if (ext === "") return false;
  return !SKIPPED_EXTENSIONS.has(ext);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/attachment-filter.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attachment-filter.js test/attachment-filter.test.js
git commit -m "feat: add attachment type filter"
```

---

## Task 4: Filename builder (pure)

**Files:**
- Create: `src/lib/filename.js`
- Test: `test/filename.test.js`

Builds `<uuid>.<ext>` for attachments (preserving original extension) and `<uuid>.html` for messages. Uses `extensionOf` from Task 3 to stay DRY.

- [ ] **Step 1: Write the failing test**

```javascript
// test/filename.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentFilename, htmlFilename } from "../src/lib/filename.js";

test("attachmentFilename keeps the original lowercased extension", () => {
  const out = attachmentFilename("018f9a2c-1234-7abc-8def-000000000000", "Teklif.PDF");
  assert.equal(out, "018f9a2c-1234-7abc-8def-000000000000.pdf");
});

test("attachmentFilename with no extension yields uuid with no dot", () => {
  const out = attachmentFilename("018f9a2c-1234-7abc-8def-000000000000", "noext");
  assert.equal(out, "018f9a2c-1234-7abc-8def-000000000000");
});

test("htmlFilename appends .html", () => {
  const out = htmlFilename("018f9a2c-1234-7abc-8def-000000000000");
  assert.equal(out, "018f9a2c-1234-7abc-8def-000000000000.html");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/filename.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/filename.js
import { extensionOf } from "./attachment-filter.js";

/**
 * Build an attachment filename: "<uuid>.<ext>" preserving the original extension.
 * If the original name has no extension, returns just the uuid.
 * @param {string} uuid
 * @param {string} originalName
 * @returns {string}
 */
export function attachmentFilename(uuid, originalName) {
  const ext = extensionOf(originalName);
  return ext ? `${uuid}.${ext}` : uuid;
}

/**
 * Build an HTML filename for a message: "<uuid>.html".
 * @param {string} uuid
 * @returns {string}
 */
export function htmlFilename(uuid) {
  return `${uuid}.html`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/filename.test.js`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filename.js test/filename.test.js
git commit -m "feat: add filename builder"
```

---

## Task 5: HTML escaping (pure)

**Files:**
- Create: `src/lib/html-escape.js`
- Test: `test/html-escape.test.js`

Escapes text that goes into HTML text nodes and attribute values (header values, original filenames). The email body HTML is NOT passed through this — it is embedded as-is per spec.

- [ ] **Step 1: Write the failing test**

```javascript
// test/html-escape.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, escapeAttr } from "../src/lib/html-escape.js";

test("escapeHtml escapes the five significant characters", () => {
  assert.equal(escapeHtml(`<b>&"'`), "&lt;b&gt;&amp;&quot;&#39;");
});

test("escapeHtml leaves plain text untouched", () => {
  assert.equal(escapeHtml("Merhaba Dünya"), "Merhaba Dünya");
});

test("escapeHtml coerces non-strings and nullish to empty-safe output", () => {
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(42), "42");
});

test("escapeAttr escapes quotes and angle brackets for attribute context", () => {
  assert.equal(escapeAttr(`a"b<c`), "a&quot;b&lt;c");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/html-escape.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/html-escape.js

/**
 * Escape a value for safe insertion into an HTML text node.
 * Nullish becomes "", non-strings are coerced with String().
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Escape a value for safe insertion into a double-quoted HTML attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttr(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/html-escape.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/html-escape.js test/html-escape.test.js
git commit -m "feat: add HTML escaping helpers"
```

---

## Task 6: CID rewriting (pure)

**Files:**
- Create: `src/lib/cid-rewrite.js`
- Test: `test/cid-rewrite.test.js`

Given the body HTML and a map from `contentId` → relative attachment path, rewrite `src="cid:..."` (and `url(cid:...)`) references to point at the exported files. Content-IDs in `cid:` URLs may be wrapped in angle brackets in headers but appear bare in the body; the map is keyed by the bare content-id.

- [ ] **Step 1: Write the failing test**

```javascript
// test/cid-rewrite.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteCidReferences } from "../src/lib/cid-rewrite.js";

test("rewrites double-quoted cid src to relative attachment path", () => {
  const body = `<img src="cid:logo123"> text`;
  const map = new Map([["logo123", "attachments/018f-uuid.png"]]);
  const out = rewriteCidReferences(body, map);
  assert.equal(out, `<img src="attachments/018f-uuid.png"> text`);
});

test("rewrites single-quoted cid src", () => {
  const body = `<img src='cid:logo123'>`;
  const map = new Map([["logo123", "attachments/018f-uuid.png"]]);
  assert.equal(rewriteCidReferences(body, map), `<img src='attachments/018f-uuid.png'>`);
});

test("rewrites cid inside CSS url()", () => {
  const body = `<div style="background:url(cid:bg9)"></div>`;
  const map = new Map([["bg9", "attachments/bg.jpg"]]);
  assert.equal(
    rewriteCidReferences(body, map),
    `<div style="background:url(attachments/bg.jpg)"></div>`,
  );
});

test("leaves unknown cids untouched", () => {
  const body = `<img src="cid:missing">`;
  const out = rewriteCidReferences(body, new Map());
  assert.equal(out, `<img src="cid:missing">`);
});

test("is case-insensitive on the cid: scheme keyword only", () => {
  const body = `<img src="CID:Logo123">`;
  const map = new Map([["Logo123", "attachments/x.png"]]);
  assert.equal(rewriteCidReferences(body, map), `<img src="attachments/x.png">`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cid-rewrite.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/cid-rewrite.js

/**
 * Rewrite cid: references in an HTML body to relative attachment paths.
 * Handles src="cid:ID", src='cid:ID', and url(cid:ID). The cid: scheme
 * keyword is matched case-insensitively; the content-id itself is matched
 * exactly against the provided map keys.
 * Unknown content-ids are left unchanged.
 * @param {string} bodyHtml
 * @param {Map<string,string>} cidToPath  content-id (bare, no angle brackets) -> relative path
 * @returns {string}
 */
export function rewriteCidReferences(bodyHtml, cidToPath) {
  if (!bodyHtml) return bodyHtml;
  // Matches cid: followed by the id up to a closing quote, paren, or whitespace.
  return bodyHtml.replace(/cid:([^"'()\s>]+)/gi, (match, id) => {
    const path = cidToPath.get(id);
    return path === undefined ? match : path;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cid-rewrite.test.js`
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cid-rewrite.js test/cid-rewrite.test.js
git commit -m "feat: add cid reference rewriting"
```

---

## Task 7: HTML document builder (pure)

**Files:**
- Create: `src/lib/html-builder.js`
- Test: `test/html-builder.test.js`

Assembles the full self-contained HTML: a header table (all headers, escaped), the body embedded as-is (with cid refs already rewritten by the caller), and an attachment list (exported items link to `attachments/<uuid>.<ext>`, skipped items shown with a note and no link).

- [ ] **Step 1: Write the failing test**

```javascript
// test/html-builder.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtmlDocument } from "../src/lib/html-builder.js";

const baseInput = {
  headers: { subject: "Merhaba <test>", from: "a@x.com", to: "b@y.com", date: "Mon, 07 Jul 2026 10:00:00 +0300" },
  bodyHtml: "<p>Gövde &amp; içerik</p>",
  attachments: [
    { originalName: "teklif.pdf", relativePath: "attachments/uuid1.pdf", exported: true },
    { originalName: "virus.exe", relativePath: null, exported: false },
  ],
};

test("output is a full HTML document with UTF-8 meta", () => {
  const html = buildHtmlDocument(baseInput);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<meta charset="utf-8">/i);
});

test("header values are escaped in the header table", () => {
  const html = buildHtmlDocument(baseInput);
  assert.match(html, /Merhaba &lt;test&gt;/);
  assert.ok(!html.includes("Merhaba <test>"));
});

test("body html is embedded verbatim (not escaped)", () => {
  const html = buildHtmlDocument(baseInput);
  assert.ok(html.includes("<p>Gövde &amp; içerik</p>"));
});

test("exported attachment is linked by relative path with original name shown", () => {
  const html = buildHtmlDocument(baseInput);
  assert.match(html, /<a href="attachments\/uuid1\.pdf">teklif\.pdf<\/a>/);
});

test("skipped attachment is listed with a note and no link", () => {
  const html = buildHtmlDocument(baseInput);
  assert.ok(html.includes("virus.exe"));
  assert.ok(!html.includes(`href="attachments`) || !html.includes("virus.exe</a>"));
  assert.match(html, /virus\.exe.*(export edilmedi|not exported)/i);
});

test("attachment original names are escaped", () => {
  const html = buildHtmlDocument({
    ...baseInput,
    attachments: [{ originalName: `a<b>.pdf`, relativePath: "attachments/u.pdf", exported: true }],
  });
  assert.match(html, /a&lt;b&gt;\.pdf/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/html-builder.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/html-builder.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/html-builder.test.js`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: PASS — all tests from Tasks 2–7 pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/html-builder.js test/html-builder.test.js
git commit -m "feat: add HTML document builder"
```

---

## Task 8: Experiment API — schema + implementation (privileged file I/O)

**Files:**
- Create: `src/api/FileExport/schema.json`
- Create: `src/api/FileExport/implementation.js`

This is the only privileged code. Five functions: `pickFolder` (nsIFilePicker folder chooser), `joinPath`, `makeDir`, `writeText`, `writeBytes`. Not unit-testable with Node (requires Thunderbird internals) — verified manually in Task 11.

- [ ] **Step 1: Write the schema**

```json
// src/api/FileExport/schema.json
[
  {
    "namespace": "FileExport",
    "functions": [
      {
        "name": "pickFolder",
        "type": "function",
        "async": true,
        "description": "Open a native folder chooser. Returns absolute path or null if cancelled.",
        "parameters": [
          { "name": "title", "type": "string", "description": "Dialog title" }
        ]
      },
      {
        "name": "makeDir",
        "type": "function",
        "async": true,
        "description": "Create a directory (and parents) if missing.",
        "parameters": [
          { "name": "absolutePath", "type": "string", "description": "Absolute directory path" }
        ]
      },
      {
        "name": "writeText",
        "type": "function",
        "async": true,
        "description": "Write a UTF-8 text file.",
        "parameters": [
          { "name": "absolutePath", "type": "string", "description": "Absolute file path" },
          { "name": "text", "type": "string", "description": "UTF-8 content" }
        ]
      },
      {
        "name": "writeBytes",
        "type": "function",
        "async": true,
        "description": "Write a binary file from an array of byte values.",
        "parameters": [
          { "name": "absolutePath", "type": "string", "description": "Absolute file path" },
          { "name": "byteArray", "type": "array", "items": { "type": "integer" }, "description": "Byte values 0-255" }
        ]
      },
      {
        "name": "joinPath",
        "type": "function",
        "async": true,
        "description": "Join path segments in an OS-correct way.",
        "parameters": [
          { "name": "base", "type": "string", "description": "Base absolute path" },
          { "name": "segments", "type": "array", "items": { "type": "string" }, "description": "Path segments to append" }
        ]
      }
    ]
  }
]
```

- [ ] **Step 2: Write the implementation**

```javascript
// src/api/FileExport/implementation.js

// Experiment APIs run in the privileged parent process with access to
// Thunderbird/Gecko internals: Cc, Ci, Services, IOUtils, PathUtils.

var FileExport = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      FileExport: {
        async pickFolder(title) {
          const win = Services.wm.getMostRecentWindow("mail:3pane");
          const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
          fp.init(win.browsingContext, title, Ci.nsIFilePicker.modeGetFolder);
          const result = await new Promise((resolve) => fp.open(resolve));
          if (result !== Ci.nsIFilePicker.returnOK) {
            return null;
          }
          return fp.file.path;
        },

        async joinPath(base, segments) {
          return PathUtils.join(base, ...segments);
        },

        async makeDir(absolutePath) {
          await IOUtils.makeDirectory(absolutePath, { ignoreExisting: true, createAncestors: true });
        },

        async writeText(absolutePath, text) {
          await IOUtils.writeUTF8(absolutePath, text);
        },

        async writeBytes(absolutePath, byteArray) {
          await IOUtils.write(absolutePath, new Uint8Array(byteArray));
        },
      },
    };
  }
};
```

- [ ] **Step 3: Sanity-check JSON validity of the schema**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/api/FileExport/schema.json','utf8')); console.log('schema OK')"`
Expected: prints `schema OK` (no JSON syntax errors).

- [ ] **Step 4: Commit**

```bash
git add src/api/FileExport/schema.json src/api/FileExport/implementation.js
git commit -m "feat: add FileExport experiment API (folder picker + IOUtils writes)"
```

---

## Task 9: Manifest (MV3 + experiment_apis + menus + permissions)

**Files:**
- Create: `src/manifest.json`

- [ ] **Step 1: Write the manifest**

```json
// src/manifest.json
{
  "manifest_version": 3,
  "name": "Email HTML Export",
  "version": "0.1.0",
  "description": "Export selected emails to a chosen folder as HTML with attachments.",
  "author": "Selman Gülmez",
  "browser_specific_settings": {
    "gecko": {
      "id": "email-html-export@guralporselen.com.tr",
      "strict_min_version": "128.0",
      "strict_max_version": "152.*"
    }
  },
  "background": {
    "scripts": ["background.js"]
  },
  "permissions": [
    "menus",
    "messagesRead",
    "notifications"
  ],
  "icons": {
    "16": "icons/export-16.png",
    "32": "icons/export-32.png",
    "64": "icons/export-64.png"
  },
  "experiment_apis": {
    "FileExport": {
      "schema": "api/FileExport/schema.json",
      "parent": {
        "scopes": ["addon_parent"],
        "paths": [["FileExport"]],
        "script": "api/FileExport/implementation.js"
      }
    }
  }
}
```

- [ ] **Step 2: Validate manifest JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/manifest.json','utf8')); console.log('manifest OK')"`
Expected: prints `manifest OK`.

- [ ] **Step 3: Commit**

```bash
git add src/manifest.json
git commit -m "feat: add MV3 manifest with experiment API and menus"
```

---

## Task 10: Background orchestration (Thunderbird-facing glue)

**Files:**
- Create: `src/background.js`

Wires everything together: registers the context menu, reads messages/attachments via `messages` API, calls the pure `lib/` functions, and persists via the `FileExport` experiment. Not Node-unit-tested (depends on `browser.*`); verified manually in Task 11. Every pure decision it makes is delegated to already-tested `lib/` functions.

- [ ] **Step 1: Write background.js**

```javascript
// src/background.js
import { uuidv7 } from "./lib/uuidv7.js";
import { isExportableFilename } from "./lib/attachment-filter.js";
import { attachmentFilename, htmlFilename } from "./lib/filename.js";
import { rewriteCidReferences } from "./lib/cid-rewrite.js";
import { buildHtmlDocument } from "./lib/html-builder.js";

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
        // plain-only: escape and wrap in <pre>. Import escape lazily to keep DRY.
        const { escapeHtml } = await import("./lib/html-escape.js");
        bodyHtml = `<pre>${escapeHtml(bodies.plain ?? "")}</pre>`;
      }

      const rawAttachments = await browser.messages.listAttachments(msg.id);
      const cidToPath = new Map();
      const attachmentEntries = [];
      const filesToWrite = [];

      for (const att of rawAttachments) {
        const exportable = isExportableFilename(att.name);
        if (!exportable) {
          skippedCount++;
          attachmentEntries.push({ originalName: att.name, relativePath: null, exported: false });
          continue;
        }
        const uuid = uuidv7();
        const fname = attachmentFilename(uuid, att.name);
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
```

- [ ] **Step 2: Syntax-check the module with Node (parse only, browser globals absent)**

Run: `node --check src/background.js`
Expected: exit 0 (no syntax errors). `--check` parses without executing, so missing `browser` global is fine.

- [ ] **Step 3: Commit**

```bash
git add src/background.js
git commit -m "feat: add background orchestration for email export"
```

---

## Task 11: Manual integration verification in Thunderbird

**Files:** none (manual verification). Requires Thunderbird 128+ installed.

- [ ] **Step 1: Add placeholder icons**

Create three small PNG placeholder icons at `src/icons/export-16.png`, `src/icons/export-32.png`, `src/icons/export-64.png` (any simple PNG; can be a solid-color square). Note: icons must live under `src/` because `web-ext` uses `--source-dir=src`; the manifest references them as `icons/export-*.png` relative to `src/`. If ImageMagick is available:

Run:
```bash
mkdir -p icons
for s in 16 32 64; do
  node -e "const fs=require('fs');const size=$s;/* 1x1 transparent PNG scaled by TB is fine as placeholder */const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');fs.writeFileSync('icons/export-'+size+'.png',png)"
done
```
Expected: three PNG files exist under `icons/`.

- [ ] **Step 2: Launch Thunderbird with the extension loaded**

Run: `npm run run:tb`
Expected: a temporary Thunderbird instance launches with the extension installed. (If `web-ext` cannot find Thunderbird automatically, pass `--firefox=/path/to/thunderbird` — on Windows e.g. `web-ext run --source-dir=src --firefox="C:\Program Files\Mozilla Thunderbird\thunderbird.exe"`.)

- [ ] **Step 3: Verify the happy path**

Manual checks in the launched Thunderbird:
1. Select 2–3 messages in the message list; at least one must have attachments and one an inline image.
2. Right-click → confirm "HTML olarak dışa aktar" appears.
3. Click it → confirm a real folder chooser opens; pick a folder (try one outside Downloads, e.g. `D:\`).
4. After completion, confirm the summary notification appears.
5. On disk, confirm: one `<uuid>.html` per email at the folder root; `attachments/` subfolder with `<uuid>.<ext>` files; extensions preserved.
6. Open an HTML file in a browser: header table shows all headers; body renders; inline images display (cid rewritten); attachment list links open the correct files.

Expected: all six checks pass.

- [ ] **Step 4: Verify edge cases**

1. Cancel the folder chooser → nothing is written, no error notification.
2. Export an email containing a `.zip` or `.exe` attachment → that attachment is skipped and listed as "export edilmedi" in the HTML; skipped count in the notification is correct.
3. Export a plain-text-only email → body renders inside `<pre>`, no crash.
4. Export an email with a Turkish/special-character subject → subject displays correctly (UTF-8), no broken HTML.

Expected: all four behave as described.

- [ ] **Step 5: Record results and commit any fixes**

If any check fails, fix the relevant `lib/` function (add a failing unit test first) or the glue in `background.js`, re-run, then:

```bash
git add -A
git commit -m "fix: address integration findings from manual verification"
```

If everything passes with no changes, no commit is needed for this task.

---

## Task 12: Package for distribution (.xpi)

**Files:**
- Create: `web-ext-artifacts/` (generated)

- [ ] **Step 1: Lint the extension**

Run: `npx web-ext lint --source-dir=src`
Expected: no errors. Warnings about the experiment API / privileged code are acceptable and expected; note them for the ATN review. Fix any hard errors before proceeding.

- [ ] **Step 2: Build the package**

Run: `npm run build`
Expected: a `.zip` is produced in `web-ext-artifacts/`. Confirm the artifact name.

- [ ] **Step 3: Rename to .xpi for ATN**

Run:
```bash
node -e "const fs=require('fs');const d='web-ext-artifacts';const z=fs.readdirSync(d).find(f=>f.endsWith('.zip'));fs.copyFileSync(d+'/'+z, d+'/'+z.replace(/\.zip$/,'.xpi'));console.log('created', z.replace(/\.zip$/,'.xpi'))"
```
Expected: a `.xpi` copy exists alongside the `.zip`. ATN accepts `.zip`, `.xpi`, `.crx`, `.jar`, `.xml`; `.xpi` is conventional for Thunderbird.

- [ ] **Step 4: Commit build config (not artifacts)**

Add `web-ext-artifacts/` and `node_modules/` to `.gitignore`:

```bash
node -e "require('fs').writeFileSync('.gitignore','node_modules/\nweb-ext-artifacts/\n')"
git add .gitignore
git commit -m "chore: add gitignore for artifacts and deps"
```

---

## Task 13: Prepare ATN submission materials

**Files:**
- Create: `docs/STORE_LISTING.md`

- [ ] **Step 1: Write the store listing draft**

```markdown
# ATN Store Listing — Email HTML Export

**Name:** Email HTML Export

**Summary (short):** Export selected emails to a folder you choose, as self-contained HTML with their attachments.

**Description:**
Select one or more emails, right-click, and choose "HTML olarak dışa aktar". Pick any folder (local disk or network drive). Each email is saved as a self-contained HTML file (all headers + original body), and its attachments are saved into an `attachments/` subfolder, referenced relatively from the HTML. Attachment files are renamed with a time-ordered UUID (UUIDv7) while keeping their original extension. Inline images are rewritten to display offline. Archives and executables are skipped for safety.

**Permissions rationale (for reviewers):**
- `messagesRead` — to read the selected messages and their attachments for export.
- `menus` — to add the right-click "Export as HTML" action to the message list.
- `notifications` — to show an export-complete summary.
- Experiment API `FileExport` — used solely to (1) open a native folder chooser (`nsIFilePicker` modeGetFolder) and (2) write files with `IOUtils`/`PathUtils`. No network access, no data leaves the machine.

**Source note:** The privileged code is confined to `src/api/FileExport/implementation.js` (folder picker + file writes only).

**License:** TBD (confirm with author — MIT or GPLv3).

**Distribution steps (performed by the add-on owner on their ATN account):**
1. Sign in at https://addons.thunderbird.net.
2. Submit a New Add-on → choose "On your own" first to get a signed build for local testing, or "On this site" to list publicly after review.
3. Upload the `.xpi` from `web-ext-artifacts/`.
4. Provide this listing text and screenshots.
5. Respond to reviewer questions (privileged code is manually reviewed).
```

- [ ] **Step 2: Commit**

```bash
git add docs/STORE_LISTING.md
git commit -m "docs: add ATN store listing draft"
```

---

## Open items carried from the spec (resolve before public listing)

- **License** — choose MIT or GPLv3 and add a `LICENSE` file. (ImportExportTools NG, the reference addon, is GPLv3.)
- **Real icons** — replace the placeholder PNGs with a designed icon set (16/32/64).
- **`strict_max_version` maintenance** — bump when new Thunderbird series are released.
