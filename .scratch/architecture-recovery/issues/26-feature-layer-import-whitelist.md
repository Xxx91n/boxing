# 26 — Feature-layer sibling import whitelist

**What to build:** Make accepted feature-layer sibling imports explicit either with a machine-checked whitelist or as recorded ADR-0016 errata.

**Blocked by:** 23 — Mental model deep research

**Status:** done

- [x] Enumerate the current feature-layer sibling imports from the current module graph.
- [x] Choose a whitelist guard or an ADR-0016 errata with explicit accepted edges.
- [x] Implement the chosen decision without adding a dependency.
- [x] Update the import guard and relevant ADR text to match the decision.
- [x] Verify the guard passes the current graph and fails an intentionally unapproved edge.
- [x] Write the closure report named in the handoff.
