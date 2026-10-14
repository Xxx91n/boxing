# Security rules (SEC series — v3.7.9f security audit)

Externalized from AGENTS.md (2026-10-14 governance pass). Live MUST rules; load
when a task touches the named surface (paste handling, import, persistence,
URLs, CSP).

| Rule | Level | Description |
|---|---|---|
| SEC-01 | MUST | Mock fallback api = mock MUST NOT pollute self.chrome / self.browser globals. Keep mock local to avoid breaking other extensions or browser internals in file:// test mode. |
| SEC-03 | MUST | All contentEditable title elements MUST have a paste event listener that forces plain-text insertion via document.execCommand('insertText', false, ...). Prevents rich-text/HTML injection through paste. Applies to: large box title, small box title, inner crumb title. |
| SEC-06 | MUST | Import JSON payloads MUST be size-capped at 2MB (JSON.stringify(data).length > 2_000_000 → rejected). Prevents stack overflow / OOM from excessively deep or large malicious imports. |
| SEC-08 | MUST | High-frequency saveLayout() calls (drag end, pan end, zoom) MUST use saveLayoutDebounced() with 300ms debounce. Direct saveLayout() retained for critical paths: enter/exit boxes, delete, pin/expand toggle, title blur, import. Note: as of A6, layoutStorage uses storage.local (10MB / unlimited with permission), not storage.sync — storage.sync has a 100KB total / 8KB per-item quota and a 120 writes/min (2/sec) rate limit. storage.local removes the rate limit but keep the debounce for I/O performance. |
| SEC-11 | MUST | ensureHttpsUrl() MUST reject javascript:, data:, vbscript: protocols before any URL construction. These dangerous protocols are returned as-is (unmodified) so callers can reject them further. |
| SEC-15 | MUST | ntp/index.html MUST include a <meta> Content-Security-Policy header: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' https: data:; connect-src 'self' https:;. This prevents XSS, inline script injection, and unauthorized external resource loading. |
