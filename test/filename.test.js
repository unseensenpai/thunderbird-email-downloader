import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentFilename, htmlFilename } from "../src/lib/filename.js";

const UUID = "018f9a2c-1234-7abc-8def-000000000000";

test("attachmentFilename appends the given extension", () => {
  assert.equal(attachmentFilename(UUID, "pdf"), `${UUID}.pdf`);
  assert.equal(attachmentFilename(UUID, "png"), `${UUID}.png`);
});

test("attachmentFilename with null/empty extension yields uuid with no dot", () => {
  assert.equal(attachmentFilename(UUID, null), UUID);
  assert.equal(attachmentFilename(UUID, ""), UUID);
});

test("htmlFilename appends .html", () => {
  assert.equal(htmlFilename(UUID), `${UUID}.html`);
});
