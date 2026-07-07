import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isExportableFilename,
  SKIPPED_EXTENSIONS,
  resolveAttachment,
} from "../src/lib/attachment-filter.js";

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

test("files with no extension are skipped by the name-only filter", () => {
  assert.equal(isExportableFilename("README"), false);
});

test("SKIPPED_EXTENSIONS contains the documented set", () => {
  for (const ext of ["zip", "rar", "7z", "tar", "gz", "exe", "msi", "bat", "cmd", "com", "scr", "dll", "js", "vbs"]) {
    assert.ok(SKIPPED_EXTENSIONS.has(ext), ext);
  }
});

// --- resolveAttachment: the full MIME-aware policy ---

test("resolveAttachment: named file with normal extension is exported, extension preserved", () => {
  const r = resolveAttachment({ name: "Teklif.PDF", contentType: "application/pdf" });
  assert.deepEqual(r, { exported: true, extension: "pdf" });
});

test("resolveAttachment: named archive/executable is skipped even with a benign contentType", () => {
  assert.deepEqual(
    resolveAttachment({ name: "backup.zip", contentType: "application/octet-stream" }),
    { exported: false, extension: null },
  );
  assert.deepEqual(
    resolveAttachment({ name: "setup.exe", contentType: "application/octet-stream" }),
    { exported: false, extension: null },
  );
});

test("resolveAttachment: extensionless image is exported with extension derived from MIME", () => {
  assert.deepEqual(
    resolveAttachment({ name: "ScreenCapture", contentType: "image/png" }),
    { exported: true, extension: "png" },
  );
  assert.deepEqual(
    resolveAttachment({ name: "ScreenCapture", contentType: "image/jpeg" }),
    { exported: true, extension: "jpg" },
  );
});

test("resolveAttachment: extensionless non-image is skipped", () => {
  assert.deepEqual(
    resolveAttachment({ name: "data", contentType: "application/octet-stream" }),
    { exported: false, extension: null },
  );
  assert.deepEqual(
    resolveAttachment({ name: "noext", contentType: "application/pdf" }),
    { exported: false, extension: null },
  );
});

test("resolveAttachment: extensionless image with unknown image subtype is skipped", () => {
  assert.deepEqual(
    resolveAttachment({ name: "weird", contentType: "image/x-unknown-format" }),
    { exported: false, extension: null },
  );
});

test("resolveAttachment: missing contentType falls back to name-only behavior", () => {
  assert.deepEqual(
    resolveAttachment({ name: "photo.png", contentType: undefined }),
    { exported: true, extension: "png" },
  );
  assert.deepEqual(
    resolveAttachment({ name: "noext", contentType: undefined }),
    { exported: false, extension: null },
  );
});
