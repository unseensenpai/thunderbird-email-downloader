import { extensionForMimeType, isImageMimeType } from "./mime.js";

/** Extensions that are never exported (archives, executables, scripts). */
export const SKIPPED_EXTENSIONS = new Set([
  "zip", "rar", "7z", "tar", "gz",
  "exe", "msi", "bat", "cmd", "com", "scr", "dll", "js", "vbs",
]);

/**
 * Return the lowercased extension of a filename without the dot, or "" if none.
 * @param {string} name
 * @returns {string}
 */
export function extensionOf(name) {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

/**
 * True if an attachment with this filename should be exported.
 * Name-only heuristic: files with no extension are treated as unknown here.
 * (For the full MIME-aware policy, use resolveAttachment.)
 * @param {string} name
 * @returns {boolean}
 */
export function isExportableFilename(name) {
  const ext = extensionOf(name);
  if (ext === "") return false;
  return !SKIPPED_EXTENSIONS.has(ext);
}

/**
 * @typedef {Object} AttachmentDecision
 * @property {boolean} exported     whether this attachment should be exported
 * @property {string|null} extension  the extension to save it under (no dot), or null
 */

/**
 * Decide whether an attachment is exported and which extension to save it under.
 *
 * Policy:
 *  - If the filename has an extension: export unless it is a blocked
 *    (archive/executable) extension; keep the original extension.
 *  - If the filename has NO extension: treat it as an image. If the MIME type
 *    yields a known image extension, export as <that extension>; otherwise skip.
 *
 * @param {{name: string, contentType?: string}} attachment
 * @returns {AttachmentDecision}
 */
export function resolveAttachment(attachment) {
  const { name, contentType } = attachment;
  const ext = extensionOf(name);

  if (ext !== "") {
    if (SKIPPED_EXTENSIONS.has(ext)) return { exported: false, extension: null };
    return { exported: true, extension: ext };
  }

  // No extension: only export if it is a recognizable image type.
  if (isImageMimeType(contentType)) {
    const imgExt = extensionForMimeType(contentType);
    if (imgExt) return { exported: true, extension: imgExt };
  }
  return { exported: false, extension: null };
}
