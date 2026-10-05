# Handoff — 29 Lockfile and CI sync

## Next agent focus

Synchronize the dependency lockfile with current package metadata and make the clean-install CI path pass without changing runtime dependencies.

## Required files

- .scratch/architecture-recovery/issues/29-lockfile-ci-sync.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- .scratch/architecture-recovery/round6-architecture-report.md
- .scratch/architecture-recovery/research-report-round6.md
- <repo root>/package.json
- <repo root>/package-lock.json
- <repo root>/.nvmrc

## Completion definition

- The lockfile is regenerated from current package metadata.
- `npm ci --dry-run --ignore-scripts` exits zero.
- The existing build and static guards remain green.
- Closure report exists at `.scratch/architecture-recovery/29-lockfile-ci-sync-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
