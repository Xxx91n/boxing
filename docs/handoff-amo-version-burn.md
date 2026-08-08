# Handoff: AMO Version Number Burn Incident

## What happened

During K5 (local CI simulation), `web-ext sign --channel unlisted` was run
with real AMO API credentials and production version numbers 3.7.0 and 3.7.1.
This uploaded both versions to AMO, where they were approved as unlisted.
The version numbers are now permanently consumed — AMO does not allow
reusing a version number even after deletion.

## Why it happened

The local simulation was meant to verify the full CI signing pipeline
(CRX3 + AMO). However, `web-ext sign` with real API keys always uploads
to AMO regardless of channel. There was no safety guard preventing this.

## What was changed

1. **build.yml** — Added safety comment block before the AMO sign step,
   warning against local use of `web-ext sign` with real keys.
2. **docs/publishing-guide.md** — Added "Part 6: Local Testing Safety"
   section with rules: use `web-ext lint` for local validation, use
   throwaway version numbers (99.9.x) if end-to-end signing test is needed.
3. **.github/workflows/README.md** — Added AMO Signing Safety warning
   section with the same guidance.

## Version number strategy going forward

- 3.7.0 and 3.7.1 are burned (unlisted, no users installed them)
- Next release: **3.7.2** and continue incrementing
- No need to switch to date-based versioning — skipping two numbers is
  invisible to users

## Key rule for future development

> **Never run `web-ext sign` locally with real API keys and production
> version numbers.** Use `web-ext lint` for validation. If end-to-end
> signing verification is required, use throwaway version numbers like
> `99.9.x` and delete the version from AMO afterwards.
