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
