# 70 — G-A 集合差原始证据（run 34626507101 / 34672647167 / 34686760142）

生成: 2026-09-12 · 源: 7 份 GitHub Actions job 日志（evidence/70-ci-logs/）

## 1. 各 job 汇总

| log | failed | flaky | skipped | passed |
|---|---|---|---|---|
| base-macos.log | 9 | 2 | 3 | 496 |
| base-ubuntu.log | 10 | 0 | 3 | 497 |
| base-windows.log | 8 | 2 | 3 | 497 |
| mid-data-golden.log | 1 | 0 | 1 | 5 |
| mid-macos.log | 36 | 0 | 5 | 509 |
| mid-ubuntu.log | 37 | 2 | 5 | 506 |
| mid-windows.log | 36 | 1 | 5 | 508 |
| new-data-golden.log | 1 | 0 | 1 | 5 |
| new-macos.log | 36 | 1 | 5 | 508 |
| new-ubuntu.log | 37 | 1 | 5 | 507 |
| new-windows.log | 36 | 1 | 5 | 508 |

## 2. 逐面三向矩阵 + 错误签名（new-ubuntu 明细）

| # | spec | 面 | base | mid | new | kind(new) | 错误 | Expected | Received |
|---|---|---|---|---|---|---|---|---|---|
| 1 | boxing-auto-expand | Auto-expand box survives enter+exit (BX-EXP-REGR) › large box with col | ubuntu | ubuntu | ubuntu | flaky | Error: expect(received).toBeGreaterThan(expected) | > 80 | 60 |
| 2 | boxing-conn-delete-action | Boxing conn delete action (ADR-0006) › ctrl+click delete persists acro | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 0 | 1 |
| 3 | boxing-conn-delete-action | Boxing conn delete action (ADR-0006) › double-click delete persists ac | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 0 | 1 |
| 4 | boxing-conn-delete-action | Boxing conn delete action (ADR-0006) › select+delete persists across r | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 0 | 1 |
| 5 | boxing-conn-delete-action | Boxing conn delete action (ADR-0006) › shift+click delete persists acr | — | macos+ubuntu+windows | macos+ubuntu+windows | failed+flaky | Error: expect(received).toBe(expected) // Object.is equali | 0 | 1 |
| 6 | boxing-data-golden | Data-layer golden gates (ticket 45) @data-golden › gate 4: cross-page  | — | data-golden+macos+ubuntu+windows | data-golden+macos+ubuntu+windows | failed+flaky | Error: expect(received).toBe(expected) // Object.is equali | 3 | 4 |
| 7 | boxing-dr-export-envelope | Ticket 51 — export envelope + full DR package + copy-before-overwrite  | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 1 | 0 |
| 8 | boxing-dr-export-envelope | Ticket 51 — export envelope + full DR package + copy-before-overwrite  | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 1 | 0 |
| 9 | boxing-dr-export-envelope | Ticket 51 — export envelope + full DR package + copy-before-overwrite  | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | "pull" | "merge" |
| 10 | boxing-empty-state-buttons | Empty state buttons + locate + perf (Bug 1-6 v2) › Bug5-dark: bm-add-b | macos+ubuntu+windows | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | "rgba(196, 168, 130, 0.12)" | "rgba(0, 0, 0, 0)" |
| 11 | boxing-innerclip | Boxing inner surface clip (BX-DEV-CLIP) › small-box at y=0 is not cove | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | false |
| 12 | boxing-innerclip | Boxing inner surface clip (BX-DEV-CLIP) › small-box at y=0 stays visib | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | false |
| 13 | boxing-innerclip | Boxing inner surface clip (BX-DEV-CLIP) › small-box title bar at y=0 d | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | false |
| 14 | boxing-innerclip-pan | Boxing inner surface clip under pan (BX-DEV-CLIP-PAN) › small-box pann | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | false |
| 15 | boxing-popup-dragselect | Boxing popup drag-select (BX-DEV-POPUP-DRAGSELECT) › edit popup stays  | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(locator).toBeVisible() failed | visible |  |
| 16 | boxing-search | Boxing bookmark search (BX-DEV-SEARCH) › search clears highlight when  | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | false | undefined |
| 17 | boxing-search | Boxing bookmark search (BX-DEV-SEARCH) › search filters large boxes by | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | undefined |
| 18 | boxing-snapshot-rotation | Snapshot split-key storage + rotation (Ticket 41R) › saveSnapshot writ | macos | — | — | — |  |  |  |
| 19 | boxing-star-sync-audit | Cross-tab star (isParent) sync — architecture audit Q1 › Scenario 1: s | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | null |
| 20 | boxing-state-sync | Boxing state isolation and live synchronization › concurrent creation  | macos+ubuntu+windows | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | 2 | 1 |
| 21 | boxing-title-select-all | Ticket 10 - title click selects all (large / small / crumb) › crumb ti | macos+ubuntu+windows | — | — | — |  |  |  |
| 22 | boxing-title-select-all | Ticket 10 - title click selects all (large / small / crumb) › large ti | macos+ubuntu+windows | — | — | — |  |  |  |
| 23 | boxing-title-select-all | Ticket 10 - title click selects all (large / small / crumb) › small ti | macos+ubuntu+windows | — | — | — |  |  |  |
| 24 | boxing-zoom-arrow | Boxing zoom-arrow visibility (BX-DEV-ZOOMARROW) › inner zoom arrows re | — | macos+ubuntu+windows | macos+ubuntu+windows | failed | Error: expect(received).toBe(expected) // Object.is equali | true | false |
| 25 | boxing-zoom-dblclick | BX-DEV-112C extra — click enter then dblclick inner after delay › sing | windows | — | — | — |  |  |  |

集合: base=8 面 · mid=20 面 · new=20 面

**mid 与 new 失败面集合完全相等（mid ≡ new）**