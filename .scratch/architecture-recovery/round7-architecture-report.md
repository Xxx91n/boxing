# Round 7 Architecture Recovery Source Report

## Objective
Close release-gap facts before creating more agent windows. Audit multilingual README parity,
English store screenshots, store/publication status, GitHub Pages, releases, and packaging
readiness. No screenshot capture is part of this report.

## Verified Findings

### Old architecture pain
The monolithic NTP file is gone. The current entry is an ESM composition root; modules are
render, conn-layer, popups, state, storage, persist, i18n, utils, favicon, credentials,
sync-engine, settings-ui, onboarding. The A1-A5 top-level laws were thinned and boundaries
are enforced by an import-graph guard. This closes the old "law instead of structure" concern.

### Flaky and load governance
Quarantine tags are absent from test specs. A host-environment incident register remains with
three entries due 2026-10-06. Test process mutex and changed-surface selection exist. Bare npm
test still maps to full, but mutex is present. This is a follow-up, not a blocker.

### README localization
Root English README is the most complete. zh_CN is structurally reasonable but missing several
sections. zh_TW is structurally corrupted: usage and privacy content appears inside the table
of contents and the sections are duplicated. Other locales vary. Fix scope is bounded to
generated/stored docs, not extension runtime.

### Screenshots
Five tracked PNG files exist under docs/store-assets/screenshots. Filenames map to ordinal
content: canvas, boxes, connections, settings, bookmark editing. Main README links the first
as proof and the grid. Whether the rendered pixels are English and semantically truthful needs
a later capture ticket. This round does not retake screenshots.

### Publication and packaging
- https://xxx91n.github.io/boxing/ returns 404.
- https://xxx91n.github.io/boxing/privacy-policy.html returns 200.
- GitHub API reports zero releases. README download buttons point to an empty release list.
- Local dist build produces .zip, unsigned .crx, and unsigned .xpi.
- A store listing cannot be inferred from guessed extension URLs because public store links
  contain an opaque ID/name. Need authoritative store URLs/IDs from owner.

## Ticket Decomposition

Ticket 34: repair locale structure and parity.
Ticket 35: verify publication surface via authoritative URL research and report truth status.
Ticket 36: capture English store screenshots and replace tracked PNGs.
Ticket 37: reconcile README release/install claims with actual release artifacts.

## Out Of Scope This Round
- Store submission itself.
- New packages or framework migration.
- Running the full browser suite except what an individual ticket requires.
- Rewriting historical ADRs.
- Changing extension runtime code except screenshot fixture/build support when necessary.
