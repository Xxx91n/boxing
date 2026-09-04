# 21 — Import graph guard and spec cluster mapping

**What to build:** Turn the documented module-boundary rules into a machine-checked test gate, and define a mapping from changed module clusters to the smallest relevant Playwright spec subset.

**Blocked by:** 19 — Mental model and test governance deep research

**Status:** done

- [x] Add a no-dependency import graph assertion to the normal test command.
- [x] Forbid background import, reverse facade/leaf imports, import cycles, and barrel-style re-exports.
- [x] Publish a module-to-spec cluster mapping that is used by the changed-surface selector.
- [x] Keep leaf changes safe by falling back to the full suite when their closure is ambiguous.
- [x] Verify the gate fails on an intentionally forbidden edge and passes on the current module graph.
