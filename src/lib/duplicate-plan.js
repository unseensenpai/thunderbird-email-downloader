import { lookupEntry } from "./export-index.js";

/**
 * @typedef {Object} KeyedMessage
 * @property {string} key       persistent message key
 * @property {object} message   the original MessageHeader
 */

/**
 * @typedef {Object} DuplicateItem
 * @property {string} key
 * @property {object} message
 * @property {string} existingHtml        html filename already on disk, reused on overwrite
 * @property {string[]} staleAttachments  attachment paths to delete on overwrite
 */

/**
 * @typedef {Object} DuplicatePlan
 * @property {KeyedMessage[]} fresh
 * @property {DuplicateItem[]} duplicates
 * @property {number} total
 */

/**
 * Split keyed messages into those absent from the index (fresh) and those
 * already present (duplicates). Pure: no I/O, no mutation.
 * @param {KeyedMessage[]} keyed
 * @param {import("./export-index.js").ExportIndex} index
 * @returns {DuplicatePlan}
 */
export function buildDuplicatePlan(keyed, index) {
  /** @type {KeyedMessage[]} */
  const fresh = [];
  /** @type {DuplicateItem[]} */
  const duplicates = [];

  for (const item of keyed) {
    const entry = lookupEntry(index, item.key);
    if (entry === null) {
      fresh.push(item);
    } else {
      duplicates.push({
        key: item.key,
        message: item.message,
        existingHtml: entry.html,
        staleAttachments: entry.attachments,
      });
    }
  }

  return { fresh, duplicates, total: keyed.length };
}
