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
    entries: {
      "a@b": { html: "x.html", attachments: ["attachments/y.pdf"], exportedAt: "t", subject: "s" },
    },
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
  idx = upsertEntry(idx, "k", {
    html: "a.html",
    attachments: ["attachments/n.pdf"],
    exportedAt: "t2",
    subject: "s2",
  });
  assert.equal(idx.entries.k.exportedAt, "t2");
  assert.deepEqual(idx.entries.k.attachments, ["attachments/n.pdf"]);
});

test("serializeIndex round-trips through parseIndex", () => {
  let idx = emptyIndex();
  idx = upsertEntry(idx, "k", {
    html: "a.html",
    attachments: ["attachments/b.pdf"],
    exportedAt: "t",
    subject: "s",
  });
  assert.deepEqual(parseIndex(serializeIndex(idx)), idx);
});
