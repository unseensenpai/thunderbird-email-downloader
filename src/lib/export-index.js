/** Filename written into the target folder. Visible on Windows (the dot does not hide it). */
export const INDEX_FILENAME = ".export-index.json";

/** Current on-disk format version. */
export const INDEX_VERSION = 1;

/**
 * @typedef {Object} IndexEntry
 * @property {string} html          html filename, relative to the target folder
 * @property {string[]} attachments attachment paths, relative to the target folder
 * @property {string} exportedAt    ISO timestamp
 * @property {string} subject       for humans reading the file; never used in logic
 */

/**
 * @typedef {Object} ExportIndex
 * @property {number} version
 * @property {Record<string, IndexEntry>} entries
 */

/** @returns {ExportIndex} */
export function emptyIndex() {
  return { version: INDEX_VERSION, entries: {} };
}

/**
 * Parse index JSON. `null` means the file is absent, which is not an error.
 * Malformed or unknown-version content THROWS: silently falling back to an
 * empty index would disable duplicate detection and overwrite user data.
 * @param {string|null} text
 * @returns {ExportIndex}
 */
export function parseIndex(text) {
  if (text === null || text === undefined) return emptyIndex();

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`Index dosyası bozuk (geçersiz JSON): ${err.message}`);
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Index dosyası bozuk: kök bir nesne olmalı.");
  }
  if (raw.version !== INDEX_VERSION) {
    throw new Error(`Index dosyası bilinmeyen sürüm: ${raw.version} (beklenen ${INDEX_VERSION}).`);
  }
  if (raw.entries === null || typeof raw.entries !== "object" || Array.isArray(raw.entries)) {
    throw new Error("Index dosyası bozuk: entries bir nesne olmalı.");
  }

  /** @type {Record<string, IndexEntry>} */
  const entries = {};
  for (const [key, value] of Object.entries(raw.entries)) {
    entries[key] = {
      html: value.html,
      attachments: Array.isArray(value.attachments) ? value.attachments : [],
      exportedAt: value.exportedAt ?? "",
      subject: value.subject ?? "",
    };
  }
  return { version: raw.version, entries };
}

/**
 * @param {ExportIndex} index
 * @param {string} key
 * @returns {IndexEntry|null}
 */
export function lookupEntry(index, key) {
  return Object.prototype.hasOwnProperty.call(index.entries, key) ? index.entries[key] : null;
}

/**
 * Return a NEW index with `key` set to `entry`. Does not mutate `index`.
 * @param {ExportIndex} index
 * @param {string} key
 * @param {IndexEntry} entry
 * @returns {ExportIndex}
 */
export function upsertEntry(index, key, entry) {
  return { version: index.version, entries: { ...index.entries, [key]: entry } };
}

/**
 * @param {ExportIndex} index
 * @returns {string}
 */
export function serializeIndex(index) {
  return JSON.stringify(index, null, 2);
}
