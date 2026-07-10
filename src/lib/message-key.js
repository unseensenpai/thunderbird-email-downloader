/**
 * Normalize an RFC 5322 Message-ID: strip surrounding angle brackets,
 * trim, lowercase. Returns null when there is no usable id.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeMessageId(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^<|>$/g, "").trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

/**
 * Serialize the fallback identity fields. The date MUST use toISOString():
 * toString() is locale- and timezone-dependent, so the same message would
 * hash differently on different machines.
 * @param {{author?: string, date?: Date, subject?: string, size?: number}} msg
 * @returns {string}
 */
function fallbackSource(msg) {
  const author = msg.author ?? "";
  const date = msg.date instanceof Date ? msg.date.toISOString() : "";
  const subject = msg.subject ?? "";
  const size = msg.size === undefined || msg.size === null ? "0" : String(msg.size);
  return [author, date, subject, size].join("|");
}

/**
 * Persistent identity for a message.
 * Prefers the Message-ID header; falls back to a SHA-256 of identity fields.
 * @param {{headerMessageId?: string|null, author?: string, date?: Date, subject?: string, size?: number}} msg
 * @returns {Promise<string>} "<message-id>" or "sha256:<hex>"
 */
export async function messageKey(msg) {
  const id = normalizeMessageId(msg.headerMessageId);
  if (id !== null) return id;

  const bytes = new TextEncoder().encode(fallbackSource(msg));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
