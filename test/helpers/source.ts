// Boxing e2e helper — source-text assertions that ignore comments.
//
// Why this exists (ticket 121): several specs pin a source contract with
// `expect(src).not.toContain('contentEditable')` — "the old contentEditable title
// implementation is gone, not merely unused". Read against the whole file, that
// assertion also matches the prose in a comment explaining WHY it is gone
// ("it also removes the contentEditable HTML surface, so pasted markup can never
// reach the layout"), so the test fails while the product is correct.
//
// The fix must not soften the assertion: a reintroduced `el.contentEditable = 'true'`
// still has to fail the suite. So the check keeps its full-file reach and only drops
// comments first — the words may be discussed, they may not be executed.
//
// The scanner understands the three JavaScript string forms (single, double, template)
// and `//` / `/* */` comments. Regex literals are not tracked specially: none of the
// files asserted on this way contain a quotation mark or a comment opener inside a
// regex literal, and the helper only ever replaces comments with spaces, so a
// mis-read can at worst leave a comment in place (the assertion then fails loudly)
// rather than silently blanking real code.

/**
 * Replaces every JavaScript comment with spaces, leaving all other characters
 * (including newlines and offsets) untouched.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch; i++;
      while (i < n) {
        const c = source[i];
        if (c === '\\') { out += c + (source[i + 1] ?? ''); i += 2; continue; }
        out += c; i++;
        if (c === quote) break;
      }
      continue;
    }
    out += ch; i++;
  }
  return out;
}
