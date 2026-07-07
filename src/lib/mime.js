/** Map of known image MIME types to their canonical file extension. */
const IMAGE_MIME_TO_EXT = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/bmp", "bmp"],
  ["image/tiff", "tiff"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["image/svg+xml", "svg"],
]);

/**
 * Normalize a MIME type: strip parameters (after ";") and lowercase.
 * @param {unknown} contentType
 * @returns {string} normalized MIME type, or "" if not a usable string
 */
function normalizeMimeType(contentType) {
  if (typeof contentType !== "string") return "";
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Return the canonical file extension for a MIME type, or null if unknown.
 * @param {unknown} contentType
 * @returns {string|null}
 */
export function extensionForMimeType(contentType) {
  const mime = normalizeMimeType(contentType);
  if (mime === "") return null;
  return IMAGE_MIME_TO_EXT.get(mime) ?? null;
}

/**
 * True if the MIME type is an image type (image/*).
 * @param {unknown} contentType
 * @returns {boolean}
 */
export function isImageMimeType(contentType) {
  const mime = normalizeMimeType(contentType);
  return mime.startsWith("image/");
}
