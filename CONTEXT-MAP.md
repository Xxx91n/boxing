# Boxing — Context Map

Multi-context documentation layout. This repo keeps two independent CONTEXT.md
files, each scoped to a different concern rather than a different package.

## Contexts

| Context | Location | Scope |
|---|---|---|
| Build & Dev-Load | [CONTEXT.md](CONTEXT.md) | Cross-platform build pipeline vocabulary: BX-XPLAT invariants, dist directory naming, Chrome vs Firefox manifest tailoring, dev-load terminology. |
| Domain Glossary | [docs/CONTEXT.md](docs/CONTEXT.md) | Boxing domain model: Boxes, Connections (Lines), DSU/box groups, Settings, Theme Pack System, Storage, Mutation API, Architectural Invariants, Performance (ADR-0013). |

## System-wide decisions

[docs/adr/](docs/adr/) holds all ADRs (0001..0015+). Both contexts share this
single decision log; there are no per-context `src/<context>/docs/adr/` trees.

## How agents read this repo

Per the grill `domain.md` consumer rule:

1. Read this `CONTEXT-MAP.md` at the repo root first.
2. Read each CONTEXT.md relevant to the topic at hand:
   - Build/release plumbing → root `CONTEXT.md`.
   - Domain concepts, data model, invariants → `docs/CONTEXT.md`.
3. Read ADRs in `docs/adr/` that touch the area you are about to work in.

If any of these files don't exist, proceed silently; the `/domain-modeling`
skill creates them lazily when terms or decisions actually get resolved.
