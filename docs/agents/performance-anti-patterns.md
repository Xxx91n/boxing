## Performance Anti-Patterns (DO NOT DO — ADR-0013)

The following optimizations were investigated, confirmed unnecessary by code analysis, and are FORBIDDEN. A new model that proposes any of these has not read this section.

| ID | Anti-Pattern | Why analyzed and rejected |
|---|---|---|
| BX-PERF-A1 | renderCanvas DOM diff (replace innerHTML='' with incremental update) | Q3 chose B (SVG line pool only). pplyExternalLayout (ntp.js:3960) calls enderCanvas() and depends on *full rebuild* semantics to handle cross-tab add/delete/move. DOM diff would require auditing all 9 enderCanvas callers for fresh-DOM assumptions — risk to multi-tab sync is too high. enderCanvas full rebuild stays as-is. |
| BX-PERF-A2 | rAF batching for onBoxDragMove (buffer mousemove coords, apply in next frame) | Q4=C. Adds 1-frame (~16ms) latency that violates the follow-hand UX principle. onBoxDragMove hot path: style.left/top O(1), refreshConnsForBoxSync O(k), moveGroupTogether O(m*n) to fixed by grid hash. All other ops O(1)/O(k). No frame batching needed. |
| BX-PERF-A3 | WeakMap geometry caches for oxMidPoint | Q4=C. oxMidPoint reads el.style.left/top + width/height — already O(1). WeakMap cache would have near-zero hit rate during drag (the moved box invalidates its entry every frame). Premature optimization. |
| BX-PERF-A4 | Incremental saveLayout storage (split layout into multiple chrome.storage keys / diff patches) | Q5=C. chrome.storage.set() does not support partial key updates. Full JSON.stringify of 30KB layout takes <1ms. saveLayout is cold-path + 120ms debounced. Pan/zoom uses persistViewState(true), not saveLayout(). Splitting complicates cross-tab merge and adds async round-trips. |
| BX-PERF-A5 | Event listener audit / cleanup optimization | 154 ddEventListener / 30 emoveEventListener — but dynamic box-DOM listeners are GC'd by innerHTML='', popup listeners are properly removed, drag listeners are removed in onBoxDragEnd. No leak found. Not a performance issue. |

These anti-patterns are **permanently documented** so a new model inheriting this project does not re-investigate them. Every item above was analyzed at the code level (line references, call counts, caller audits) before being rejected. See [docs/adr/0013-performance-optimization-grid-hash.md](docs/adr/0013-performance-optimization-grid-hash.md) for the full analysis.
