# 30 — Agent version-control rule reconciliation

**What to build:** Remove the contradiction between project agent rules and the GitButler-only workflow so future agents receive one authoritative control path.

**Blocked by:** 28 — Release merge and governance deep research (done — research-report-round6.md delivered)

**Status:** done

- [x] Locate every project rule that mentions raw version-control commands.
- [x] Translate those rules to the GitButler workflow or move them to history without losing their loss-avoidance intent.
- [x] Ensure every referenced authority path still resolves.
- [x] Scan for prohibited raw control commands and confirm zero matches in the reconciled rule set.
- [x] Run the repository formatting guard and write the closure report named by the handoff.
