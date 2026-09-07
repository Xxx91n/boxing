# Handoff — 29 Lockfile and CI sync

## Next agent focus

Synchronize the dependency lockfile with current package metadata and make the clean-install CI path pass without changing runtime dependencies.

## Required files

- D:/Aworker/crx/boxing/.scratch/architecture-recovery/issues/29-lockfile-ci-sync.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/spec.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/WORKFLOW.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/round6-architecture-report.md
- D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round6.md
- D:/Aworker/crx/boxing/package.json
- D:/Aworker/crx/boxing/package-lock.json
- D:/Aworker/crx/boxing/.nvmrc

## Completion definition

- The lockfile is regenerated from current package metadata.
- `npm ci --dry-run --ignore-scripts` exits zero.
- The existing build and static guards remain green.
- Closure report exists at `D:/Aworker/crx/boxing/.scratch/architecture-recovery/29-lockfile-ci-sync-report.md`.

## Suggested skills

The next agent should call the Skill tool for the following skill names in this order:

- `$implement`
- `$code-review`
- `$handoff`
