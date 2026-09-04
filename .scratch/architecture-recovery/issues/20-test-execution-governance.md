# 20 — Test execution governance

**What to build:** Make repeated test runs bounded, cancellable, and failure-recoverable. Use the round 4 research decision to stop running every test on every changed path and to keep browser concurrency from oversubscribing the host.

**Blocked by:** 19 — Mental model and test governance deep research

**Status:** done

- [x] Apply an explicit timeout, cancellation, and resource ceiling to the normal test workflow.
- [x] Add a native failure-rerun path without adding a new dependency.
- [x] Add changed-surface selection using the approved minimal model.
- [x] Keep the quarantine lane separate and non-blocking when it is meant to be patrol-only.
- [x] Verify a small source-only change runs a bounded subset and the full suite still passes on the relevant lane.
