# Start Here

**New to Boxing? Pick your role and follow exactly one section below.** Every pointer on this page resolves from this file.

This page exists because the repository carries three different kinds of documents that used to be interleaved, which made the entry point ambiguous:

| Layer | Lives in | Audience | Changes with |
|---|---|---|---|
| **Product docs** | `README.md`, `docs/index.md`, `docs/i18n/` | users, store reviewers | every release |
| **Project and architecture docs** | `CONTRIBUTING.md`, `CONTEXT.md`, `docs/CONTEXT.md`, `docs/adr/`, `docs/DESIGN.md` | contributors, maintainers | decisions (ADR) |
| **Agent work logs** | `.scratch/` | agents and auditors only | every agent session |

`.scratch/` is a **work-log layer, not documentation**: it holds per-ticket handoffs, issues, prompts and reports. It is cited as evidence, never used as a reading path, and nothing in it is a product claim.

## 1. I want to use Boxing

- [README.md](../README.md) - install, usage, privacy, screenshots
- [docs/index.md](index.md) - the GitHub Pages front page
- Other languages: [docs/i18n/](i18n/) - 13 localized READMEs

## 2. I want to contribute code

Read in this order:

1. [CONTRIBUTING.md](../CONTRIBUTING.md) - clone, build, test, commit conventions
2. [CONTEXT.md](../CONTEXT.md) - build and dev-load invariants (`BX-XPLAT-*`) and the dev-load rules
3. [docs/css-dual-write-convention.md](css-dual-write-convention.md) - shared CSS must be written twice

Then the domain and design decisions:

- [docs/CONTEXT.md](CONTEXT.md) - architecture glossary and module map
- [docs/adr/](adr/) - architecture decision records; start with 0007, 0008, 0013, 0017
- [docs/DESIGN.md](DESIGN.md) - design system: tokens, palette, typography, dark mode

## 3. I am an AI coding agent

- [AGENTS.md](../AGENTS.md) - **the single entry point**: hard rules, tool routing, verification commands
- [docs/agents/README.md](agents/README.md) - on-demand reference layer; do not preload
- [docs/testing-governance.md](testing-governance.md) - quarantine register, expiry rule, incident register

## 4. I am publishing or auditing a release

- [docs/publishing-guide.md](publishing-guide.md) - store rollout and signing workflow
- [docs/store-publishing-plan.md](store-publishing-plan.md) - rollout plan
- [docs/adr/0017-release-data-gate.md](adr/0017-release-data-gate.md) - the release gate definition
- [docs/privacy-policy.md](privacy-policy.md) - user-facing privacy policy

## Rules of thumb

- Product claims live only in `README.md` and `docs/index.md`. A release is published only when the gate in ADR-0017 is satisfied - do not infer release state from a build number, a package, or a CI run.
- Anything under `.scratch/` is session evidence: cite it, do not read it as a guide, and never delete it - several reports are the only surviving record of a decision.
