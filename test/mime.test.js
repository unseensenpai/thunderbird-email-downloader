import { test } from "node:test";
import assert from "node:assert/strict";
import { extensionForMimeType, isImageMimeType } from "../src/lib/mime.js";

test("maps common image MIME types to extensions", () => {
  assert.equal(extensionForMimeType("image/png"), "png");
  assert.equal(extensionForMimeType("image/jpeg"), "jpg");
  assert.equal(extensionForMimeType("image/gif"), "gif");
  assert.equal(extensionForMimeType("image/webp"), "webp");
  assert.equal(extensionForMimeType("image/bmp"), "bmp");
  assert.equal(extensionForMimeType("image/tiff"), "tiff");
});

test("ignores parameters and case in the MIME type", () => {
  assert.equal(extensionForMimeType("IMAGE/PNG"), "png");
  assert.equal(extensionForMimeType("image/jpeg; name=foo"), "jpg");
});

test("returns null for MIME types with no known extension", () => {
  assert.equal(extensionForMimeType("application/octet-stream"), null);
  assert.equal(extensionForMimeType("image/x-unknown-format"), null);
  assert.equal(extensionForMimeType(""), null);
  assert.equal(extensionForMimeType(undefined), null);
});

test("isImageMimeType detects image/* regardless of case and params", () => {
  assert.equal(isImageMimeType("image/png"), true);
  assert.equal(isImageMimeType("IMAGE/JPEG; name=x"), true);
  assert.equal(isImageMimeType("application/pdf"), false);
  assert.equal(isImageMimeType(""), false);
  assert.equal(isImageMimeType(undefined), false);
});
