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
  assert.deepEqual(
    plan.fresh.map((f) => f.key),
    ["a", "c"]
  );
  assert.deepEqual(
    plan.duplicates.map((d) => d.key),
    ["b"]
  );
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
