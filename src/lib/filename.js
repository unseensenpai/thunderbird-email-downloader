/**
 * Build an attachment filename: "<uuid>.<ext>".
 * The extension is supplied explicitly by the caller (resolved from the
 * original name or from the MIME type). If it is empty/null, returns just
 * the uuid with no dot.
 * @param {string} uuid
 * @param {string|null} extension  extension without a leading dot, or null
 * @returns {string}
 */
export function attachmentFilename(uuid, extension) {
  return extension ? `${uuid}.${extension}` : uuid;
}

/**
 * Build an HTML filename for a message: "<uuid>.html".
 * @param {string} uuid
 * @returns {string}
 */
export function htmlFilename(uuid) {
  return `${uuid}.html`;
}
