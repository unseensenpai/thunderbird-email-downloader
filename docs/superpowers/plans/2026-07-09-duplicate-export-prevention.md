# Mükerrer Export Engelleme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bir e-posta bir hedef klasöre daha önce export edildiyse tespit et, kullanıcıya toplu olarak Atla/Üzerine yaz/İptal sor.

**Architecture:** Saf mantık `src/lib/` altında üç yeni modülde (kimlik üretimi, index veri yapısı, mükerrer planı) — hepsi Thunderbird'süz `node --test` ile test edilebilir. Dosya sistemi ve diyalog işleri Experiment API'ye eklenen üç yeni fonksiyona düşer. `background.js` bunları birleştirir.

**Tech Stack:** WebExtension (Thunderbird MV3), Experiment API (XPCOM: `nsIPromptService`, `IOUtils`), `node:test` + `node:assert/strict`, `crypto.subtle` (Node 21+ ve WebExtension'da global).

**Spec:** `docs/superpowers/specs/2026-07-09-duplicate-export-prevention-design.md`

---

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `src/lib/message-key.js` (yeni) | Bir e-postadan kalıcı kimlik üretir. Message-ID normalize eder, yoksa SHA-256 fallback. |
| `src/lib/export-index.js` (yeni) | Index nesnesini ayrıştırır, doğrular, günceller, serileştirir. I/O yok. |
| `src/lib/duplicate-plan.js` (yeni) | Anahtarları index'le karşılaştırır; yeniler/mükerrerler ve silinecek ekleri döndürür. I/O yok. |
| `src/api/FileExport/implementation.js` (değişir) | `readTextIfExists`, `confirmDuplicates`, `deleteFile` eklenir. |
| `src/api/FileExport/schema.json` (değişir) | Üç yeni fonksiyonun şeması. |
| `src/background.js` (değişir) | Akışı birleştirir; `runExport` hata koruması altına alınır. |
| `test/message-key.test.js` (yeni) | |
| `test/export-index.test.js` (yeni) | |
| `test/duplicate-plan.test.js` (yeni) | |

**Bağımlılık yönü:** `background.js` → `lib/*` ve `browser.FileExport`. `lib/*` birbirine bağımlı değil, hiçbiri `browser`'a dokunmaz.

**Constants (Task 2'de tanımlanır, sonraki task'lar kullanır):**
- `INDEX_FILENAME = ".export-index.json"` — `export-index.js`'ten export edilir.
- `INDEX_VERSION = 1` — `export-index.js`'ten export edilir.

---

## Task 1: `message-key.js` — kalıcı e-posta kimliği

**Files:**
- Create: `src/lib/message-key.js`
- Test: `test/message-key.test.js`

Spec kuralı: `headerMessageId` doluysa köşeli parantezleri sıyır + küçük harfe çevir. Boşsa `author|date|subject|size` alanlarından SHA-256 üret, `sha256:<hex>` döndür. `date` **`toISOString()`** ile (yerelleştirilmiş `toString()` aynı e-posta için makineden makineye farklı hash üretir).

- [ ] **Step 1: Write the failing test**

`test/message-key.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { messageKey, normalizeMessageId } from "../src/lib/message-key.js";

test("normalizeMessageId strips angle brackets and lowercases", () => {
  assert.equal(normalizeMessageId("<ABC@Example.COM>"), "abc@example.com");
  assert.equal(normalizeMessageId("abc@example.com"), "abc@example.com");
  assert.equal(normalizeMessageId("  <x@y>  "), "x@y");
});

test("normalizeMessageId returns null for empty-ish input", () => {
  assert.equal(normalizeMessageId(""), null);
  assert.equal(normalizeMessageId("   "), null);
  assert.equal(normalizeMessageId(null), null);
  assert.equal(normalizeMessageId(undefined), null);
  assert.equal(normalizeMessageId("<>"), null);
});

test("messageKey uses headerMessageId when present", async () => {
  const key = await messageKey({
    headerMessageId: "<Hello@Example.com>",
    author: "a@b.c",
    date: new Date("2026-01-01T00:00:00Z"),
    subject: "s",
    size: 10,
  });
  assert.equal(key, "hello@example.com");
});

test("messageKey falls back to sha256 when headerMessageId missing", async () => {
  const key = await messageKey({
    headerMessageId: "",
    author: "a@b.c",
    date: new Date("2026-01-01T00:00:00Z"),
    subject: "s",
    size: 10,
  });
  assert.match(key, /^sha256:[0-9a-f]{64}$/);
});

test("messageKey fallback is stable for identical input", async () => {
  const msg = {
    headerMessageId: null,
    author: "a@b.c",
    date: new Date("2026-01-01T00:00:00Z"),
    subject: "s",
    size: 10,
  };
  assert.equal(await messageKey(msg), await messageKey({ ...msg }));
});

test("messageKey fallback differs when any field differs", async () => {
  const base = {
    headerMessageId: null,
    author: "a@b.c",
    date: new Date("2026-01-01T00:00:00Z"),
    subject: "s",
    size: 10,
  };
  const k = await messageKey(base);
  assert.notEqual(k, await messageKey({ ...base, author: "z@b.c" }));
  assert.notEqual(k, await messageKey({ ...base, subject: "t" }));
  assert.notEqual(k, await messageKey({ ...base, size: 11 }));
  assert.notEqual(k, await messageKey({ ...base, date: new Date("2026-01-02T00:00:00Z") }));
});

test("messageKey fallback tolerates missing optional fields", async () => {
  const key = await messageKey({ headerMessageId: null, date: new Date("2026-01-01T00:00:00Z") });
  assert.match(key, /^sha256:[0-9a-f]{64}$/);
});

test("messageKey fallback tolerates a missing date", async () => {
  const key = await messageKey({ headerMessageId: null, author: "a@b.c", subject: "s", size: 1 });
  assert.match(key, /^sha256:[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="messageKey|normalizeMessageId"`

Beklenen: FAIL — `Cannot find module '../src/lib/message-key.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/message-key.js`:

```javascript
/**
 * Normalize an RFC 5322 Message-ID: strip surrounding angle brackets,
 * trim, lowercase. Returns null when there is no usable id.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeMessageId(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^<|>$/g, "").trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

/**
 * Serialize the fallback identity fields. The date MUST use toISOString():
 * toString() is locale- and timezone-dependent, so the same message would
 * hash differently on different machines.
 * @param {{author?: string, date?: Date, subject?: string, size?: number}} msg
 * @returns {string}
 */
function fallbackSource(msg) {
  const author = msg.author ?? "";
  const date = msg.date instanceof Date ? msg.date.toISOString() : "";
  const subject = msg.subject ?? "";
  const size = msg.size === undefined || msg.size === null ? "0" : String(msg.size);
  return [author, date, subject, size].join("|");
}

/**
 * Persistent identity for a message.
 * Prefers the Message-ID header; falls back to a SHA-256 of identity fields.
 * @param {{headerMessageId?: string|null, author?: string, date?: Date, subject?: string, size?: number}} msg
 * @returns {Promise<string>} "<message-id>" or "sha256:<hex>"
 */
export async function messageKey(msg) {
  const id = normalizeMessageId(msg.headerMessageId);
  if (id !== null) return id;

  const bytes = new TextEncoder().encode(fallbackSource(msg));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="messageKey|normalizeMessageId"`

Beklenen: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/message-key.js test/message-key.test.js
git commit -m "feat: add persistent message key derivation"
```

---

## Task 2: `export-index.js` — index veri yapısı

**Files:**
- Create: `src/lib/export-index.js`
- Test: `test/export-index.test.js`

Sorumluluk: JSON metnini ayrıştır, doğrula, giriş ekle, serileştir. Dosya sistemine **dokunmaz**.

Spec kuralı: bozuk/bilinmeyen sürüm → **hata fırlat** (sessizce boş index'e düşmek mükerrer kontrolünü kapatır). `null` metin (dosya yok) → boş index, bu hata değil.

- [ ] **Step 1: Write the failing test**

`test/export-index.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INDEX_FILENAME,
  INDEX_VERSION,
  emptyIndex,
  parseIndex,
  serializeIndex,
  lookupEntry,
  upsertEntry,
} from "../src/lib/export-index.js";

test("INDEX_FILENAME and INDEX_VERSION are exported constants", () => {
  assert.equal(INDEX_FILENAME, ".export-index.json");
  assert.equal(INDEX_VERSION, 1);
});

test("emptyIndex has the current version and no entries", () => {
  const idx = emptyIndex();
  assert.equal(idx.version, INDEX_VERSION);
  assert.deepEqual(idx.entries, {});
});

test("parseIndex(null) returns an empty index (file absent is not an error)", () => {
  assert.deepEqual(parseIndex(null), emptyIndex());
});

test("parseIndex parses a valid index", () => {
  const text = JSON.stringify({
    version: 1,
    entries: { "a@b": { html: "x.html", attachments: ["attachments/y.pdf"], exportedAt: "t", subject: "s" } },
  });
  const idx = parseIndex(text);
  assert.equal(idx.version, 1);
  assert.equal(idx.entries["a@b"].html, "x.html");
  assert.deepEqual(idx.entries["a@b"].attachments, ["attachments/y.pdf"]);
});

test("parseIndex defaults a missing attachments field to []", () => {
  const text = JSON.stringify({ version: 1, entries: { "a@b": { html: "x.html" } } });
  assert.deepEqual(parseIndex(text).entries["a@b"].attachments, []);
});

test("parseIndex throws on malformed JSON", () => {
  assert.throws(() => parseIndex("{not json"), /bozuk|malformed|JSON/i);
});

test("parseIndex throws on an unknown version", () => {
  const text = JSON.stringify({ version: 99, entries: {} });
  assert.throws(() => parseIndex(text), /sürüm|version/i);
});

test("parseIndex throws when entries is not an object", () => {
  assert.throws(() => parseIndex(JSON.stringify({ version: 1, entries: [] })), /entries/i);
});

test("lookupEntry returns the entry or null", () => {
  const idx = parseIndex(JSON.stringify({ version: 1, entries: { k: { html: "a.html" } } }));
  assert.equal(lookupEntry(idx, "k").html, "a.html");
  assert.equal(lookupEntry(idx, "missing"), null);
});

test("upsertEntry adds a new entry and returns a new index", () => {
  const idx = emptyIndex();
  const next = upsertEntry(idx, "k", {
    html: "a.html",
    attachments: ["attachments/b.pdf"],
    exportedAt: "2026-07-09T00:00:00.000Z",
    subject: "s",
  });
  assert.equal(next.entries.k.html, "a.html");
  assert.deepEqual(idx.entries, {}, "original index must not be mutated");
});

test("upsertEntry overwrites an existing entry", () => {
  let idx = emptyIndex();
  idx = upsertEntry(idx, "k", { html: "a.html", attachments: [], exportedAt: "t1", subject: "s1" });
  idx = upsertEntry(idx, "k", { html: "a.html", attachments: ["attachments/n.pdf"], exportedAt: "t2", subject: "s2" });
  assert.equal(idx.entries.k.exportedAt, "t2");
  assert.deepEqual(idx.entries.k.attachments, ["attachments/n.pdf"]);
});

test("serializeIndex round-trips through parseIndex", () => {
  let idx = emptyIndex();
  idx = upsertEntry(idx, "k", { html: "a.html", attachments: ["attachments/b.pdf"], exportedAt: "t", subject: "s" });
  assert.deepEqual(parseIndex(serializeIndex(idx)), idx);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="[Ii]ndex"`

Beklenen: FAIL — `Cannot find module '../src/lib/export-index.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/export-index.js`:

```javascript
/** Filename written into the target folder. Visible on Windows (the dot does not hide it). */
export const INDEX_FILENAME = ".export-index.json";

/** Current on-disk format version. */
export const INDEX_VERSION = 1;

/**
 * @typedef {Object} IndexEntry
 * @property {string} html          html filename, relative to the target folder
 * @property {string[]} attachments attachment paths, relative to the target folder
 * @property {string} exportedAt    ISO timestamp
 * @property {string} subject       for humans reading the file; never used in logic
 */

/**
 * @typedef {Object} ExportIndex
 * @property {number} version
 * @property {Record<string, IndexEntry>} entries
 */

/** @returns {ExportIndex} */
export function emptyIndex() {
  return { version: INDEX_VERSION, entries: {} };
}

/**
 * Parse index JSON. `null` means the file is absent, which is not an error.
 * Malformed or unknown-version content THROWS: silently falling back to an
 * empty index would disable duplicate detection and overwrite user data.
 * @param {string|null} text
 * @returns {ExportIndex}
 */
export function parseIndex(text) {
  if (text === null || text === undefined) return emptyIndex();

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`Index dosyası bozuk (geçersiz JSON): ${err.message}`);
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Index dosyası bozuk: kök bir nesne olmalı.");
  }
  if (raw.version !== INDEX_VERSION) {
    throw new Error(`Index dosyası bilinmeyen sürüm: ${raw.version} (beklenen ${INDEX_VERSION}).`);
  }
  if (raw.entries === null || typeof raw.entries !== "object" || Array.isArray(raw.entries)) {
    throw new Error("Index dosyası bozuk: entries bir nesne olmalı.");
  }

  /** @type {Record<string, IndexEntry>} */
  const entries = {};
  for (const [key, value] of Object.entries(raw.entries)) {
    entries[key] = {
      html: value.html,
      attachments: Array.isArray(value.attachments) ? value.attachments : [],
      exportedAt: value.exportedAt ?? "",
      subject: value.subject ?? "",
    };
  }
  return { version: raw.version, entries };
}

/**
 * @param {ExportIndex} index
 * @param {string} key
 * @returns {IndexEntry|null}
 */
export function lookupEntry(index, key) {
  return Object.prototype.hasOwnProperty.call(index.entries, key) ? index.entries[key] : null;
}

/**
 * Return a NEW index with `key` set to `entry`. Does not mutate `index`.
 * @param {ExportIndex} index
 * @param {string} key
 * @param {IndexEntry} entry
 * @returns {ExportIndex}
 */
export function upsertEntry(index, key, entry) {
  return { version: index.version, entries: { ...index.entries, [key]: entry } };
}

/**
 * @param {ExportIndex} index
 * @returns {string}
 */
export function serializeIndex(index) {
  return JSON.stringify(index, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="[Ii]ndex"`

Beklenen: PASS (12 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-index.js test/export-index.test.js
git commit -m "feat: add export index data structure"
```

---

## Task 3: `duplicate-plan.js` — mükerrer ayrımı

**Files:**
- Create: `src/lib/duplicate-plan.js`
- Test: `test/duplicate-plan.test.js`

Sorumluluk: `[{key, message}]` listesini index'le karşılaştır. `fresh` (yeni) ve `duplicates` (mükerrer) dizilerini döndür. Mükerrerler için index'teki mevcut `html` adı ve silinecek `attachments` listesi de taşınır — üzerine yazma bunları kullanır.

- [ ] **Step 1: Write the failing test**

`test/duplicate-plan.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyIndex, upsertEntry } from "../src/lib/export-index.js";
import { buildDuplicatePlan } from "../src/lib/duplicate-plan.js";

function indexWith(key, attachments = []) {
  return upsertEntry(emptyIndex(), key, {
    html: `${key}.html`,
    attachments,
    exportedAt: "t",
    subject: "s",
  });
}

test("empty selection yields empty plan", () => {
  const plan = buildDuplicatePlan([], emptyIndex());
  assert.deepEqual(plan.fresh, []);
  assert.deepEqual(plan.duplicates, []);
  assert.equal(plan.total, 0);
});

test("all keys absent from the index are fresh", () => {
  const keyed = [
    { key: "a", message: { id: 1 } },
    { key: "b", message: { id: 2 } },
  ];
  const plan = buildDuplicatePlan(keyed, emptyIndex());
  assert.equal(plan.fresh.length, 2);
  assert.equal(plan.duplicates.length, 0);
  assert.equal(plan.total, 2);
});

test("all keys present in the index are duplicates", () => {
  const idx = indexWith("a", ["attachments/old.pdf"]);
  const plan = buildDuplicatePlan([{ key: "a", message: { id: 1 } }], idx);
  assert.equal(plan.fresh.length, 0);
  assert.equal(plan.duplicates.length, 1);
  assert.equal(plan.duplicates[0].key, "a");
  assert.equal(plan.duplicates[0].existingHtml, "a.html");
  assert.deepEqual(plan.duplicates[0].staleAttachments, ["attachments/old.pdf"]);
});

test("mixed selection splits fresh and duplicates, preserving order", () => {
  const idx = indexWith("b");
  const keyed = [
    { key: "a", message: { id: 1 } },
    { key: "b", message: { id: 2 } },
    { key: "c", message: { id: 3 } },
  ];
  const plan = buildDuplicatePlan(keyed, idx);
  assert.deepEqual(plan.fresh.map((f) => f.key), ["a", "c"]);
  assert.deepEqual(plan.duplicates.map((d) => d.key), ["b"]);
  assert.equal(plan.total, 3);
});

test("duplicate with no recorded attachments yields an empty stale list", () => {
  const idx = indexWith("a");
  const plan = buildDuplicatePlan([{ key: "a", message: { id: 1 } }], idx);
  assert.deepEqual(plan.duplicates[0].staleAttachments, []);
});

test("each entry carries its original message through", () => {
  const idx = indexWith("b");
  const msgA = { id: 1, subject: "A" };
  const msgB = { id: 2, subject: "B" };
  const plan = buildDuplicatePlan([{ key: "a", message: msgA }, { key: "b", message: msgB }], idx);
  assert.equal(plan.fresh[0].message, msgA);
  assert.equal(plan.duplicates[0].message, msgB);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="plan|fresh|duplicate"`

Beklenen: FAIL — `Cannot find module '../src/lib/duplicate-plan.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/duplicate-plan.js`:

```javascript
import { lookupEntry } from "./export-index.js";

/**
 * @typedef {Object} KeyedMessage
 * @property {string} key       persistent message key
 * @property {object} message   the original MessageHeader
 */

/**
 * @typedef {Object} DuplicateItem
 * @property {string} key
 * @property {object} message
 * @property {string} existingHtml        html filename already on disk, reused on overwrite
 * @property {string[]} staleAttachments  attachment paths to delete on overwrite
 */

/**
 * @typedef {Object} DuplicatePlan
 * @property {KeyedMessage[]} fresh
 * @property {DuplicateItem[]} duplicates
 * @property {number} total
 */

/**
 * Split keyed messages into those absent from the index (fresh) and those
 * already present (duplicates). Pure: no I/O, no mutation.
 * @param {KeyedMessage[]} keyed
 * @param {import("./export-index.js").ExportIndex} index
 * @returns {DuplicatePlan}
 */
export function buildDuplicatePlan(keyed, index) {
  /** @type {KeyedMessage[]} */
  const fresh = [];
  /** @type {DuplicateItem[]} */
  const duplicates = [];

  for (const item of keyed) {
    const entry = lookupEntry(index, item.key);
    if (entry === null) {
      fresh.push(item);
    } else {
      duplicates.push({
        key: item.key,
        message: item.message,
        existingHtml: entry.html,
        staleAttachments: entry.attachments,
      });
    }
  }

  return { fresh, duplicates, total: keyed.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="plan|fresh|duplicate"`

Beklenen: PASS (6 test)

- [ ] **Step 5: Run the full suite to check nothing regressed**

Run: `npm test`

Beklenen: tüm testler PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/duplicate-plan.js test/duplicate-plan.test.js
git commit -m "feat: add duplicate detection plan builder"
```

---

## Task 4: Experiment API — `readTextIfExists`, `deleteFile`

**Files:**
- Modify: `src/api/FileExport/schema.json`
- Modify: `src/api/FileExport/implementation.js`

Bu iki fonksiyon Thunderbird internals kullanır; birim testi yok, Task 7'de elle doğrulanır.

`IOUtils.readUTF8` dosya yoksa fırlatır. Yakalayıp `null` döndürüyoruz — "dosya yok" bir hata değil, ilk export'un normal hâli. Ama **yalnızca** yokluk hatası yutulmalı; izin hatası gibi gerçek sorunlar yukarı gitmeli. `IOUtils.exists` ile önce bakmak yarış koşulu yaratır (kontrol ile okuma arasında dosya silinebilir), o yüzden okumayı deneyip `DOMException` adına bakıyoruz.

Doğrulandı ([IOUtils.webidl](https://searchfox.org/mozilla-central/source/dom/chrome-webidl/IOUtils.webidl)): dosya yokken atılan istisna `DOMException` olup `name === "NotFoundError"`; `IOUtils.remove(path, { ignoreAbsent: true })` dosya yoksa sessizce başarılı olur.

- [ ] **Step 1: Add the schema entries**

`src/api/FileExport/schema.json` — `functions` dizisinin sonuna, `joinPath` girdisinden sonra ekle (öncesindeki girdiye virgül eklemeyi unutma):

```json
      {
        "name": "readTextIfExists",
        "type": "function",
        "async": true,
        "description": "Read a UTF-8 text file. Returns null if it does not exist.",
        "parameters": [
          { "name": "absolutePath", "type": "string", "description": "Absolute file path" }
        ]
      },
      {
        "name": "deleteFile",
        "type": "function",
        "async": true,
        "description": "Delete a file. No error if it is already absent.",
        "parameters": [
          { "name": "absolutePath", "type": "string", "description": "Absolute file path" }
        ]
      }
```

- [ ] **Step 2: Implement both functions**

`src/api/FileExport/implementation.js` — `writeBytes` metodundan sonra, `FileExport` nesnesinin içine ekle:

```javascript
        async readTextIfExists(absolutePath) {
          try {
            return await IOUtils.readUTF8(absolutePath);
          } catch (err) {
            // Absence is not an error: the first export has no index yet.
            // Anything else (permissions, I/O) must propagate.
            if (err?.name === "NotFoundError") return null;
            throw err;
          }
        },

        async deleteFile(absolutePath) {
          await IOUtils.remove(absolutePath, { ignoreAbsent: true });
        },
```

- [ ] **Step 3: Verify the schema is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/api/FileExport/schema.json','utf8')); console.log('schema ok')"`

Beklenen: `schema ok`

- [ ] **Step 4: Verify the implementation parses**

Run: `node --check src/api/FileExport/implementation.js`

Beklenen: çıktı yok (sözdizimi geçerli)

- [ ] **Step 5: Commit**

```bash
git add src/api/FileExport/schema.json src/api/FileExport/implementation.js
git commit -m "feat: add readTextIfExists and deleteFile to FileExport API"
```

---

## Task 5: Experiment API — `confirmDuplicates`

**Files:**
- Modify: `src/api/FileExport/schema.json`
- Modify: `src/api/FileExport/implementation.js`

`nsIPromptService.confirmEx` üç butonu destekler ve basılan butonun **indeksini** döndürür. Görsel sıra platforma göre değişir (Windows'ta 0, 2, 1) ama indeksler sabittir; bu yüzden indekse göre eşliyoruz, konuma göre değil.

Kritik kısıt: kullanıcı pencereyi **X ile kapatırsa `confirmEx` 1 döndürür** (bilinen Gecko davranışı, [bugzilla#345067](https://bugzilla.mozilla.org/show_bug.cgi?id=345067)). Yani indeks 1, "bu butona basıldı" ile "pencere kapatıldı" arasında ayrım yapmaz.

Bu yüzden **İptal'i indeks 1'e** koyuyoruz. Pencereyi kapatmak da, İptal'e basmak da aynı sonucu verir: hiçbir dosyaya dokunulmaz. Üzerine yazma indeks 1'de olsaydı, X'e basan kullanıcı sessizce dosyalarını kaybederdi.

Buton indeksleri: **0 = Üzerine yaz, 1 = İptal, 2 = Atla.** Üçü de `BUTTON_TITLE_IS_STRING` ile özel metin alır.

- [ ] **Step 1: Add the schema entry**

`src/api/FileExport/schema.json` — `deleteFile` girdisinden sonra ekle (öncesine virgül):

```json
      {
        "name": "confirmDuplicates",
        "type": "function",
        "async": true,
        "description": "Ask what to do about already-exported messages. Returns 'skip' | 'overwrite' | 'cancel'.",
        "parameters": [
          { "name": "total", "type": "integer", "description": "How many messages were selected" },
          { "name": "duplicateCount", "type": "integer", "description": "How many are already exported" }
        ]
      }
```

- [ ] **Step 2: Implement confirmDuplicates**

`src/api/FileExport/implementation.js` — `deleteFile` metodundan sonra ekle:

```javascript
        async confirmDuplicates(total, duplicateCount) {
          const win = Services.wm.getMostRecentWindow("mail:3pane");
          const ps = Services.prompt;

          // Button indices are stable across platforms even though the visual
          // order is not. Index 1 is what confirmEx returns when the dialog is
          // dismissed with the window's X button (bugzilla 345067), so "Cancel"
          // sits at index 1 — dismissing must never overwrite files.
          const flags =
            ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;

          const pressed = ps.confirmEx(
            win,
            "Mükerrer e-postalar",
            `${total} e-postadan ${duplicateCount} tanesi bu klasöre daha önce aktarılmış. Ne yapılsın?`,
            flags,
            "Üzerine yaz",
            "İptal",
            "Atla",
            null,
            { value: false }
          );

          if (pressed === 0) return "overwrite";
          if (pressed === 2) return "skip";
          return "cancel";
        },
```

- [ ] **Step 3: Verify the schema is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/api/FileExport/schema.json','utf8')); console.log('schema ok')"`

Beklenen: `schema ok`

- [ ] **Step 4: Verify the implementation parses**

Run: `node --check src/api/FileExport/implementation.js`

Beklenen: çıktı yok

- [ ] **Step 5: Commit**

```bash
git add src/api/FileExport/schema.json src/api/FileExport/implementation.js
git commit -m "feat: add confirmDuplicates dialog to FileExport API"
```

---

## Task 6: `background.js` — akışı bağla ve hata korumasını ekle

**Files:**
- Modify: `src/background.js`

Üç iş birden: (a) `runExport`'u mükerrer akışına çevir, (b) her e-postanın yazdığı ekleri index'e kaydet, (c) `menus.onClicked` içinde `runExport`'u `try/catch`e al — şu an [background.js:58](../../src/background.js#L58) `pickFolder` çağrısı korumasız ve hata sessizce yutuluyor.

Ek yazma döngüsü değişiyor: artık her ek için `relativePath` zaten hesaplanıyor (`attachments/<uuid>.<ext>`), bunu `writtenAttachments` dizisinde topluyoruz.

Üzerine yazmada: **önce** yeni ekler + yeni HTML yazılır, **sonra** eski ekler silinir. Sıra spec'te sabit; hata olursa kullanıcı hem eski hem yeni dosyaya sahip olur, hiçbirine sahip olmamaktan iyidir.

- [ ] **Step 1: Replace the imports and the menu listener**

`src/background.js` — 1..21. satırları şununla değiştir:

```javascript
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

browser.menus.create({
  id: MENU_ID,
  title: "HTML olarak dışa aktar",
  contexts: ["message_list"],
});

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
```

- [ ] **Step 2: Replace runExport with the duplicate-aware version**

`src/background.js` — mevcut `runExport` fonksiyonunun tamamını (satır 57'den dosya sonuna kadar) şununla değiştir:

```javascript
/**
 * Export one message. Returns the index entry describing what was written.
 * `forcedHtmlName` reuses the existing html filename when overwriting.
 * @returns {Promise<{html: string, attachments: string[], exportedAt: string, subject: string}>}
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
    indexWarning = "\nUYARI: Index yazılamadı; bu e-postalar bir dahaki sefere mükerrer görünmeyecek.";
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
```

Not: `collectBodies`, `headerValue`, `buildDisplayHeaders` fonksiyonları dosyada olduğu gibi kalır — bunlara dokunma.

- [ ] **Step 3: Verify the file parses**

Run: `node --check src/background.js`

Beklenen: çıktı yok

- [ ] **Step 4: Run the full suite (lib modules must still pass)**

Run: `npm test`

Beklenen: tüm testler PASS

- [ ] **Step 5: Commit**

```bash
git add src/background.js
git commit -m "feat: wire duplicate detection into export flow"
```

---

## Task 7: Elle doğrulama

**Files:** yok (davranış doğrulaması)

Birim testler `lib/`i kapsar; Experiment API ve uçtan uca akış Thunderbird'de elle doğrulanır.

- [ ] **Step 1: Build and launch**

```bash
npx web-ext run --source-dir=src --firefox="C:\Program Files\Mozilla Thunderbird\thunderbird.exe" --keep-profile-changes --firefox-profile="C:\Users\sgulmez\AppData\Roaming\Thunderbird\Profiles\d85nq3od.default-release"
```

- [ ] **Step 2: First export into a fresh folder**

İki e-posta seç → sağ tık → "HTML olarak dışa aktar" → boş bir klasör seç.

Doğrula:
- Diyalog **çıkmaz** (mükerrer yok).
- Klasörde iki `.html`, bir `attachments/` ve bir `.export-index.json` var.
- `.export-index.json` içinde `version: 1` ve iki girdi var; her girdide `html` ve `attachments` alanları dolu.

- [ ] **Step 3: Re-export the same two messages — choose "Atla"**

Aynı iki e-postayı aynı klasöre export et. Diyalog çıkmalı: "2 e-postadan 2 tanesi ... daha önce aktarılmış."

**Atla**'ya bas. Doğrula:
- Yeni `.html` dosyası **oluşmaz** (klasördeki dosya sayısı değişmez).
- Bildirim: `0 e-posta ... 2 zaten mevcuttu (atlandı).`

- [ ] **Step 4: Re-export — choose "İptal"**

Aynı iki e-postayı tekrar export et, **İptal**'e bas. Doğrula:
- Hiçbir dosya değişmez, bildirim çıkmaz.

- [ ] **Step 5: Re-export — choose "Üzerine yaz" (the important one)**

Ekli bir e-posta seçtiğinden emin ol. Aynı klasöre export et, **Üzerine yaz**'a bas. Doğrula:
- `.html` dosya adı **aynı kalır** (yeni bir uuid'li html oluşmaz).
- `attachments/` içinde **yalnızca yeni** ek dosyaları var; eski uuid'li ekler silinmiş.
- `.export-index.json` içindeki `attachments` listesi yeni yolları gösteriyor.
- Bildirim: `2 üzerine yazıldı.`

- [ ] **Step 6: Dismiss the dialog with the X button**

Mükerrer bir export başlat, diyaloğu **X ile kapat**. Doğrula:
- Hiçbir dosya yazılmaz/silinmez (X = iptal, üzerine yazma **değil**).

- [ ] **Step 7: Corrupt index aborts**

`.export-index.json` dosyasını bir metin düzenleyiciyle boz (örn. baştaki `{` karakterini sil). Export dene. Doğrula:
- Bildirim: "Dışa aktarma başarısız — Index dosyası bozuk ...".
- Klasörde **hiçbir yeni dosya** oluşmaz.

Bozuk dosyayı sil, klasör tekrar temiz export alabilmeli.

- [ ] **Step 8: Message without a Message-ID**

Mümkünse Message-ID başlığı olmayan bir e-posta (örn. bir taslak) export et, sonra tekrar export et. Doğrula:
- İkinci seferde mükerrer olarak algılanır (SHA-256 fallback çalışıyor).
- Index'te anahtar `sha256:` ile başlar.

- [ ] **Step 9: Commit the plan checkboxes**

```bash
git add docs/superpowers/plans/2026-07-09-duplicate-export-prevention.md
git commit -m "docs: mark duplicate-export plan verified"
```
