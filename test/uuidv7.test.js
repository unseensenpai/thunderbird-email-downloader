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
