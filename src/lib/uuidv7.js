/**
 * Generate a UUIDv7 (time-ordered) string.
 * Layout: 48-bit ms timestamp | version(7) | 12 rand bits | variant(10) | 62 rand bits.
 * Uses globalThis.crypto.getRandomValues (Node 21 + WebExtension both provide it).
 * @returns {string} canonical lowercase UUID
 */
export function uuidv7() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  const ts = Date.now(); // milliseconds since epoch

  // 48-bit timestamp into bytes 0..5 (big-endian)
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  // version 7 in high nibble of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // RFC 4122 variant (10xxxxxx) in byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20, 32)
  );
}
