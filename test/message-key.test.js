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
