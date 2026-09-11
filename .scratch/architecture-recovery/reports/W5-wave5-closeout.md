# Wave 5 整轮收口报告

> 日期: 2026-09-12 · 角色: 架构首脑 · 分支文档: w2-brain-review-fix-launchers

## 1. 交叉核对（reports × README × issues）

| 发现 | 处置 |
|---|---|
| ADR-0009 仍写 `boxingSnapshots[]`，与 snap.v1 代码/CONTEXT/ADR-0017 矛盾 | **已修**：ADR-0009 Status 节追加 2026-09-12 修订说明 |
| issues/40 仍 ready-for-agent（已 land） | **已修**：done；人工 AC 转 ready-for-human |
| issues/42R 仍 ready-for-agent（返工已绿） | **已修**：done 7/7 |
| issues/46 done 4/4（脚本误报 4/5） | 无实物问题 |
| W1 历史节「41 FAIL」与 W2R「41R PASS」并存 | 历史时间线正确，不改写 |

其余：报告 presence 齐全；README 红线「不可发行」与 ADR-0017 一致。

## 2. 构建闭环终验（命令 + 摘要）

```
node .github/scripts/build.mjs                         → OK（A8 CSS cat + DONE）
node .github/scripts/build-demo.mjs --out .codex-tmp/closeout-pages
                                                       → OK；ntp.css>0；privacy-policy.html 存在
node scripts/import-graph-guard.mjs                    → ok:true / 14 modules / 48 edges / 0 violations
node scripts/migration-golden-guard.mjs                → ok:true / 28 / 28
node --check storage|ntp|background|settings-ui|sync-engine|utils → OK
```

## 3. 三层文档一致性

| 层 | 结论 |
|---|---|
| 代码 | snap.v1 / archiveCorrupt / archiveConflict / ensurePreUpdate / RAW_KEEP_FLOOR / needsMigration 全在 storage.js |
| CONTEXT.md | Data Resilience 节 8 词条与代码对齐 |
| docs/adr | 0017 门禁权威；**0009 已补修订**；0016 分层不变 |

## 4. Decision Ledger

落盘：`.scratch/architecture-recovery/decision-ledger-wave5.md`

- **implemented**: A-41-1, A-42-1, A-43-1, A-44-1, A-45-1, A-45-2, A-46-1, A-W1-1
- **deferred**: A-40-1（CSS 括号门禁）, A-44-2（冲突 UI）, A-45-3（冻结 reader）, A-46-2（上架人工）
- **stale**: 无

## 5. 合并栈序（**尚未执行 land/push**）

```
A. ticket-42-update-cow-before-migrate --whole-stack   # 含 42R
B. ci/data-golden-gates --whole-stack                  # 45 + 45R
C. ticket-43-crash-rescue-fork --whole-stack           # 43 + 43R
D. ticket-44-restore-merge-never-overwrite             # after C
E. ticket-46-release-data-gate                         # after A+B
F. w2-brain-review-fix-launchers                       # 复核 docs，随时
```

`but pull` 后按 A→F 逐支 land。**push 到远程前停止，等用户明确指令。**

## 6. Backlog

见 `docs/history/2026-09-12-wave5-closeout-backlog.md`（B14–B24）。

## 7. 发行结论

按 ADR-0017：G-A 未满足、G-B 未满足 → **不可发行**。W1 已 land 的 40/41/47 不构成可发行宣称。
