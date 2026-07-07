import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteCidReferences } from "../src/lib/cid-rewrite.js";

test("rewrites double-quoted cid src to relative attachment path", () => {
  const body = `<img src="cid:logo123"> text`;
  const map = new Map([["logo123", "attachments/018f-uuid.png"]]);
  const out = rewriteCidReferences(body, map);
  assert.equal(out, `<img src="attachments/018f-uuid.png"> text`);
});

test("rewrites single-quoted cid src", () => {
  const body = `<img src='cid:logo123'>`;
  const map = new Map([["logo123", "attachments/018f-uuid.png"]]);
  assert.equal(rewriteCidReferences(body, map), `<img src='attachments/018f-uuid.png'>`);
});

test("rewrites cid inside CSS url()", () => {
  const body = `<div style="background:url(cid:bg9)"></div>`;
  const map = new Map([["bg9", "attachments/bg.jpg"]]);
  assert.equal(
    rewriteCidReferences(body, map),
    `<div style="background:url(attachments/bg.jpg)"></div>`,
  );
});

test("leaves unknown cids untouched", () => {
  const body = `<img src="cid:missing">`;
  const out = rewriteCidReferences(body, new Map());
  assert.equal(out, `<img src="cid:missing">`);
});

test("is case-insensitive on the cid: scheme keyword only", () => {
  const body = `<img src="CID:Logo123">`;
  const map = new Map([["Logo123", "attachments/x.png"]]);
  assert.equal(rewriteCidReferences(body, map), `<img src="attachments/x.png">`);
});
