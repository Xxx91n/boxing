# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo uses a **single-context** layout: one glossary at the repo root.

## Before exploring, read this

- **`GLOSSARY.md`** at the repo root — domain vocabulary, data structures, and architectural invariants.

Architecture decisions are recorded as comments at the code they constrain. There is no separate ADR directory or decision ledger; when a comment and the code disagree, surface the conflict rather than silently working around it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).
