import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const URL_TITLE_PATH = pathToFileURL(path.join(EXTENSION_PATH, 'ntp/url-title.js')).href;

// Ticket 84 / spec D8 / finding V-12: auto-title rule boundaries and decode protection.
// Pure-function lane: exercises the exported engine directly, no page boot required.

test('rule engine rejects over-long patterns and degrades predictably', async () => {
  const { matchPattern, deriveTitleFromUrl, MAX_PATTERN_LENGTH, DEFAULT_AUTO_TITLE_RULES } =
    await import(URL_TITLE_PATH);

  const overLong = 'https://example.com/' + 'a'.repeat(MAX_PATTERN_LENGTH) + '/*';
  expect(overLong.length).toBeGreaterThan(MAX_PATTERN_LENGTH);
  expect(matchPattern(overLong, 'https://example.com/a')).toBe(false);

  // A rule list whose first entry is over-limit must fall through to the default
  // rules instead of matching nothing or throwing.
  const rules = [
    { pattern: overLong, type: 'first-path' },
    { pattern: 'https://example.com/*', type: 'first-path' },
  ];
  expect(deriveTitleFromUrl('https://example.com/hello', rules, true)).toBe('hello');

  // With only an over-limit rule present, the engine still returns the default fallback.
  const badOnly = [{ pattern: overLong, type: 'full-url' }];
  expect(deriveTitleFromUrl('https://example.com/hello', badOnly, true)).toBe('example');

  // Golden behavior is unchanged.
  expect(deriveTitleFromUrl('https://github.com/foo/bar', DEFAULT_AUTO_TITLE_RULES, true)).toBe('foo/bar');
  expect(deriveTitleFromUrl('https://other.com/test', DEFAULT_AUTO_TITLE_RULES, true)).toBe('other');
});

test('rule engine rejects patterns with too many wildcards', async () => {
  const { matchPattern, deriveTitleFromUrl, MAX_PATTERN_WILDCARDS } = await import(URL_TITLE_PATH);

  const manyStars = 'https://example.com/' + Array.from({ length: MAX_PATTERN_WILDCARDS + 1 }, () => '*').join('/') + '/tail';
  expect(matchPattern(manyStars, 'https://example.com/a/b/c/tail')).toBe(false);

  const rules = [
    { pattern: manyStars, type: 'first-path' },
    { pattern: 'https://example.com/*/*/*', type: 'first-two-paths' },
  ];
  // Over-limit rule is skipped; the second, valid rule still applies.
  expect(deriveTitleFromUrl('https://example.com/a/b/c', rules, true)).toBe('a/b');

  // At the limit itself the pattern still matches (boundary is inclusive).
  const atLimit = 'https://example.com/' + Array.from({ length: MAX_PATTERN_WILDCARDS }, () => '*').join('/') + '/tail';
  expect(atLimit.length).toBeLessThanOrEqual(256);
  expect(matchPattern(atLimit, 'https://example.com/a/b/c/d/e/f/g/h/tail')).toBe(true);
});

test('malformed percent-encoding falls back to hostname/domain instead of throwing', async () => {
  const { extractTitleByType, deriveTitleFromUrl, deriveTitleOrHostname } = await import(URL_TITLE_PATH);

  const malformed = new URL('https://example.com/%zz/path');
  const fallback = 'example';

  // Every path-decoding extraction type degrades to the domain fallback.
  expect(() => extractTitleByType(malformed, 'first-path')).not.toThrow();
  expect(extractTitleByType(malformed, 'first-path')).toBe(fallback);
  expect(extractTitleByType(malformed, 'first-two-paths')).toBe(fallback);
  expect(extractTitleByType(malformed, 'domain-first-path')).toBe(fallback);

  // last-path decodes the final segment; use a URL whose last segment is malformed.
  const malformedLast = new URL('https://example.com/path/%zz');
  expect(() => extractTitleByType(malformedLast, 'last-path')).not.toThrow();
  expect(extractTitleByType(malformedLast, 'last-path')).toBe(fallback);

  // deriveTitleFromUrl never surfaces the decode error.
  expect(() => deriveTitleFromUrl('https://example.com/%zz/path', null, true)).not.toThrow();
  expect(deriveTitleFromUrl('https://example.com/%zz/path', null, true)).toBe(fallback);

  // The submit-time helper is equally safe.
  expect(() => deriveTitleOrHostname('https://example.com/%zz', {})).not.toThrow();
  expect(deriveTitleOrHostname('https://example.com/%zz', {})).toBe(fallback);

  // A malformed segment in the first slot does not poison the second segment path.
  const second = new URL('https://example.com/%zz/good');
  expect(extractTitleByType(second, 'first-two-paths')).toBe(fallback);
});

test('valid percent-encoding still decodes as before', async () => {
  const { extractTitleByType, deriveTitleFromUrl } = await import(URL_TITLE_PATH);

  const encoded = new URL('https://example.com/%E4%B8%AD%E6%96%87/%E9%A1%B5');
  expect(extractTitleByType(encoded, 'first-path')).toBe('中文');
  expect(extractTitleByType(encoded, 'first-two-paths')).toBe('中文/页');

  const rules = [{ pattern: 'https://example.com/*', type: 'first-path' }];
  expect(deriveTitleFromUrl('https://example.com/%E4%B8%AD%E6%96%87', rules, true)).toBe('中文');

  // Default-rule golden path remains untouched by the decode guard.
  expect(deriveTitleFromUrl('https://github.com/a/b', null, true)).toBe('a/b');
});
