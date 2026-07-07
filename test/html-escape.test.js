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
