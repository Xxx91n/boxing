# 29 — Lockfile and CI sync

**What to build:** Make the dependency lockfile match the current package metadata so a clean install succeeds on every CI runner, and verify the CI path without changing runtime dependencies.

**Blocked by:** 28 — Release merge and governance deep research

**Status:** done

- [x] Regenerate the lockfile from the current package metadata.
- [x] Confirm the clean-install dry run exits zero and reports no missing packages.
- [x] Confirm the root lockfile version and dependency set agree with the package metadata.
- [x] Run the existing build and static guards after the dependency change.
- [x] Write the closure report named by the handoff.
