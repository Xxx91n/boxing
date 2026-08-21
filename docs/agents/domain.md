# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo uses a **multi-context** layout: two independent CONTEXT.md files, each scoped to a different concern rather than a different package.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at each `CONTEXT.md` and its scope. Read it first to know which context(s) apply to the current task.
- The relevant CONTEXT.md files per the map:
  - Build/release plumbing → root **`CONTEXT.md`** (Build & Dev-Load vocabulary).
  - Domain concepts, data model, architectural invariants → **`docs/CONTEXT.md`** (Boxing Domain Glossary & Architecture).
- **`docs/adr/`** — read ADRs that touch the area you are about to work in. All ADRs live here; there are no per-context `src/<context>/docs/adr/` subtrees.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context repo (current Boxing layout):

```
/
├── CONTEXT-MAP.md                     ← points at each CONTEXT.md + scope
├── CONTEXT.md                         ← Build & Dev-Load vocabulary (BX-XPLAT, dist dirs, manifest tailoring)
├── docs/
│   ├── CONTEXT.md                     ← Domain glossary (Boxes, Connections, DSU, Settings, ADR-0013 perf, invariants)
│   └── adr/
│       ├── 0001-dev-junctions-vs-direct-dist.md
│       └── ... 0015-chip-locate-highlight-unify.md
└── (source tree: ntp/, background.js, manifest.json, _locales/, icons/, popup/)
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant CONTEXT.md. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If an ADR in `docs/adr/` conflicts with what you observe in the code or with another ADR, surface the conflict rather than silently working around it.
