/**
 * Rewrite cid: references in an HTML body to relative attachment paths.
 * Handles src="cid:ID", src='cid:ID', and url(cid:ID). The cid: scheme
 * keyword is matched case-insensitively; the content-id itself is matched
 * exactly against the provided map keys.
 * Unknown content-ids are left unchanged.
 * @param {string} bodyHtml
 * @param {Map<string,string>} cidToPath  content-id (bare, no angle brackets) -> relative path
 * @returns {string}
 */
export function rewriteCidReferences(bodyHtml, cidToPath) {
  if (!bodyHtml) return bodyHtml;
  // Matches cid: followed by the id up to a closing quote, paren, or whitespace.
  return bodyHtml.replace(/cid:([^"'()\s>]+)/gi, (match, id) => {
    const path = cidToPath.get(id);
    return path === undefined ? match : path;
  });
}
