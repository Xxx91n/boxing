# 31 — Multi-tab state-sync failure diagnosis

**What to build:** Turn the three remaining multi-tab state-sync failures into one of two end states: a deterministic fix with evidence, or an explicitly registered quarantine entry with an expiry date.

**Blocked by:** 28 — Release merge and governance deep research

**Status:** done

- [x] Reproduce each remaining failure in isolation and capture the failure signature.
- [x] Classify each failure as an application defect or an environment-only limitation.
- [x] Repair application defects and verify the focused lane is green.
- [x] Register any environment-only remainder with the governance table and an expiry date; do not auto-extend.
- [x] Run the focused state-sync lane and write the closure report named by the handoff.
