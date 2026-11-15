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
// The scanner walks JavaScript tokens: the three string forms (single, double,
// template) and regex literals keep their contents intact, and only `//` / `/* */`
// comments are blanked. Regex literals are tracked because mistaking one for a
// comment is dangerous in exactly the direction that matters here: in
// `const re = /\/\//; el.contentEditable = 'true';` a naive scanner takes the `//`
// inside the regex as a line comment and blanks the assignment that follows, so the
// negative assertions would pass on code that reintroduced the old implementation.
//
// Comments are replaced with spaces (newlines kept), so offsets and line numbers in
// the stripped text still match the original file — a failing assertion can point at
// the real line.

// ── HTML / CSS: their own comment syntax ────────────────────────────────────
// A JavaScript scanner must not be pointed at markup: the `//` in
// `placeholder="https://dav.example.com/boxing/"` would blank the rest of the line.
// Each language gets its own pass, and every pass blanks comments only.

function blankLike(text: string): string {
  // Same shape, same length, newlines preserved (comments keep line numbers honest).
  return text.replace(/[^\n]/g, ' ');
}

/** Removes `<!-- -->` comments from markup. */
export function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, blankLike);
}

// Removes slash-star block comments from a stylesheet (CSS has no line comments).
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, blankLike);
}

/**
 * Optional `language` picks the right comment syntax for the file being read.
 * `js` is the default because that is where the negative source contracts live.
 */
export function stripComments(source: string, language: 'js' | 'html' | 'css' = 'js'): string {
  if (language === 'html') return stripHtmlComments(source);
  if (language === 'css') return stripCssComments(source);
  return stripJsComments(source);
}

/** Keywords after which a `/` starts a regex literal rather than a division. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

/** True when a `/` at this point starts a regex literal, judged from the last token. */
function regexAllowed(lastSignificant: string): boolean {
  // After a value (identifier, number, `)`, `]`, closing quote) a `/` divides.
  if (!lastSignificant) return true;              // start of input / after `;`, `{`, `(`
  if (REGEX_PRECEDING_KEYWORDS.has(lastSignificant)) return true;
  const c = lastSignificant[lastSignificant.length - 1];
  if (c === ')' || c === ']' || c === '}' || c === '"' || c === "'" || c === '`') return false;
  if (/[A-Za-z0-9_$]/.test(c)) return false;      // identifier or number → division
  return true;                                    // operators, punctuation, `(`, `,`, …
}

/**
 * Replaces every JavaScript comment with spaces, leaving all other characters
 * (including newlines and offsets) untouched.
 */
export function stripJsComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  // Last significant token, for the regex/division call.
  let lastSignificant = '';
  const push = (s: string) => { out += s; };
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { push(' '); i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      push('  '); i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        push(source[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) { push('  '); i += 2; }
      continue;
    }
    if (ch === '/' && regexAllowed(lastSignificant)) {
      // Copy the regex literal verbatim: `/`, body (escapes and classes respected), flags.
      push(ch); i++;
      let inClass = false;
      while (i < n) {
        const c = source[i];
        if (c === '\\') { push(c + (source[i + 1] ?? '')); i += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) { push(c); i++; break; }
        else if (c === '\n') break;                 // malformed: stop at the line end
        push(c); i++;
      }
      while (i < n && /[a-z]/.test(source[i])) { push(source[i]); i++; }  // flags
      lastSignificant = '/';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      push(ch); i++;
      while (i < n) {
        const c = source[i];
        if (c === '\\') { push(c + (source[i + 1] ?? '')); i += 2; continue; }
        push(c); i++;
        if (c === quote) break;
      }
      lastSignificant = quote;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i++;
      while (i < n && /[A-Za-z0-9_$]/.test(source[i])) i++;
      const token = source.slice(start, i);
      push(token);
      // A member named `return` is a value, not the return keyword.
      lastSignificant = lastSignificant === '.' ? '.' + token : token;
      continue;
    }
    push(ch);
    if (!/\s/.test(ch)) lastSignificant = ch;
    i++;
  }
  return out;
}
