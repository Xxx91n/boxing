# 25 — Test-process mutex and changed-test standardization

**What to build:** Add a zero-dependency process-level mutex around local Playwright execution and make changed-surface verification the standard local path.

**Blocked by:** 23 — Mental model deep research

**Status:** ready-for-agent

- [ ] Add a small Node wrapper that permits only one local Playwright process at a time.
- [ ] Update package scripts so the normal local verification path uses the wrapper and changed-surface selection.
- [ ] Keep the full-suite fallback for ambiguous changes and configuration/test changes.
- [ ] Verify that a second concurrent process is rejected or waits while the first holds the lock.
- [ ] Verify a bounded source-only change runs a bounded subset.
- [ ] Write the closure report named in the handoff.
