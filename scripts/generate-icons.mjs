// Generate the extension icon set (16/32/64 px) as PNGs, dependency-free.
// Motif: a rounded envelope with a downward "export" arrow, on a blue tile.
// Run: node scripts/generate-icons.mjs
//
// Uses only Node built-ins (zlib) to encode a minimal RGBA PNG.

import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "icons");

// ---- Minimal PNG encoder (RGBA, no filtering) ----

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "latin1");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode an RGBA pixel buffer (length = w*h*4) into a PNG Buffer.
 * @param {number} w
 * @param {number} h
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Each scanline is prefixed with a filter byte (0 = None).
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => {
      raw[y * (1 + w * 4) + 1 + i] = v;
    });
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Drawing ----

const COLORS = {
  bg: [0x1f, 0x6f, 0xeb, 0xff], // blue tile
  envelope: [0xff, 0xff, 0xff, 0xff], // white envelope
  fold: [0xd0, 0xdd, 0xf5, 0xff], // light fold line
  arrow: [0x2b, 0xb5, 0x5f, 0xff], // green export arrow
  transparent: [0, 0, 0, 0],
};

/**
 * Render one icon at the given size. Coordinates are computed in a
 * normalized 0..1 space then scaled, so the motif is crisp at every size.
 * @param {number} size
 * @returns {Uint8Array}
 */
function renderIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };

  const s = size;
  const corner = Math.max(1, Math.round(s * 0.18)); // rounded-corner radius

  // Rounded blue background tile.
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const inCornerCut =
        (x < corner && y < corner && (corner - x) ** 2 + (corner - y) ** 2 > corner ** 2) ||
        (x >= s - corner && y < corner && (x - (s - corner - 1)) ** 2 + (corner - y) ** 2 > corner ** 2) ||
        (x < corner && y >= s - corner && (corner - x) ** 2 + (y - (s - corner - 1)) ** 2 > corner ** 2) ||
        (x >= s - corner && y >= s - corner && (x - (s - corner - 1)) ** 2 + (y - (s - corner - 1)) ** 2 > corner ** 2);
      set(x, y, inCornerCut ? COLORS.transparent : COLORS.bg);
    }
  }

  // Envelope body: a rectangle in the upper-left area.
  const ex0 = Math.round(s * 0.16);
  const ey0 = Math.round(s * 0.24);
  const ex1 = Math.round(s * 0.72);
  const ey1 = Math.round(s * 0.70);
  for (let y = ey0; y <= ey1; y++) {
    for (let x = ex0; x <= ex1; x++) {
      const border =
        x === ex0 || x === ex1 || y === ey0 || y === ey1;
      set(x, y, border ? COLORS.fold : COLORS.envelope);
    }
  }
  // Envelope flap: two diagonals from top corners to the middle-top.
  const midx = Math.round((ex0 + ex1) / 2);
  const flapDepth = Math.round((ey1 - ey0) * 0.55);
  for (let step = 0; step <= midx - ex0; step++) {
    const y = ey0 + Math.round((step / Math.max(1, midx - ex0)) * flapDepth);
    set(ex0 + step, y, COLORS.fold);
    set(ex1 - step, y, COLORS.fold);
  }

  // Export arrow: a downward arrow in the lower-right, overlapping the tile.
  const ax = Math.round(s * 0.74); // arrow shaft center
  const aTop = Math.round(s * 0.40);
  const aBot = Math.round(s * 0.86);
  const shaftW = Math.max(1, Math.round(s * 0.055));
  for (let y = aTop; y <= aBot - Math.round(s * 0.14); y++) {
    for (let d = -shaftW; d <= shaftW; d++) set(ax + d, y, COLORS.arrow);
  }
  // Arrowhead (triangle).
  const headH = Math.round(s * 0.16);
  const headW = Math.max(2, Math.round(s * 0.13));
  for (let i = 0; i < headH; i++) {
    const y = aBot - headH + i;
    const half = Math.round(headW * (1 - i / headH));
    for (let d = -half; d <= half; d++) set(ax + d, y, COLORS.arrow);
  }

  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 64]) {
  const png = encodePng(size, size, renderIcon(size));
  writeFileSync(join(OUT_DIR, `export-${size}.png`), png);
  console.log(`wrote src/icons/export-${size}.png (${size}x${size}, ${png.length} bytes)`);
}
