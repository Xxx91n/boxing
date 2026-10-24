# Start Here

**New to Boxing? Pick your role and follow exactly one section below.** Every pointer on this page resolves from this file.

This page exists because the repository carries two different kinds of documents that used to be interleaved, which made the entry point ambiguous:

| Layer | Lives in | Audience | Changes with |
|---|---|---|---|
| **Product docs** | `README.md`, `docs/index.md`, `docs/i18n/` | users, store reviewers | every release |
| **Project and architecture docs** | `CONTRIBUTING.md`, `GLOSSARY.md`, `docs/DESIGN.md` | contributors, maintainers | product decisions |

## 1. I want to use Boxing

- [README.md](../README.md) - install, usage, privacy, screenshots
- [docs/index.md](index.md) - the GitHub Pages front page
- Other languages: [docs/i18n/](i18n/) - 13 localized READMEs

## 2. I want to contribute code

Read in this order:

1. [CONTRIBUTING.md](../CONTRIBUTING.md) - clone, build, test, commit conventions
2. [GLOSSARY.md](../GLOSSARY.md) - build and dev-load conventions
3. [docs/css-dual-write-convention.md](css-dual-write-convention.md) - shared CSS must be written twice

Then the domain and design decisions:

- [GLOSSARY.md](../GLOSSARY.md) - domain glossary and module map
- [docs/DESIGN.md](DESIGN.md) - design system: tokens, palette, typography, dark mode

## 3. I am an AI coding agent

- [AGENTS.md](../AGENTS.md) - **the single entry point**: hard rules, tool routing, verification commands

## 4. I am publishing or auditing a release

- [docs/publishing-guide.md](publishing-guide.md) - store rollout and signing workflow
- [docs/store-publishing-plan.md](store-publishing-plan.md) - rollout plan
- [docs/privacy-policy.md](privacy-policy.md) - user-facing privacy policy

## Rules of thumb

- Product claims live only in `README.md` and `docs/index.md`. A release is published only when the CI gate, the manual store golden path, and the Pages check are all satisfied - do not infer release state from a build number, a package, or a CI run.
