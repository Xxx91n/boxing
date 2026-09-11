# Wave 5 W3 首脑对抗性复核 — 44

> 日期: 2026-09-11 · 方法: 不信报告自述；工作区实跑 + 源码/guard/i18n 抽查
> 分支: ticket-44-restore-merge-never-overwrite @ nmw/oqv

## 总览

| 票 | 报告自述 | 首脑实跑 | 裁决 |
|---|---|---|---|
| 44 恢复合并+冲突副本 | 4 passed + 回归绿 | **import-merge 4 passed (10.4s)**；邻接 9 passed；guard ok | **PASS** |

---

## 44 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| mergeImportedLayout 纯函数 | utils.js 存在 + deepJsonEquals | PASS |
| archiveConflictLayouts / listConflictArchives | storage.js 存在；键 `boxingLayout.conflict.<ts>` | PASS |
| 导入默认合并、无静默丢本地 | settings-ui 接 merge/askConfirmModal；spec AC1+AC2 | PASS |
| 显式覆盖 + 确认 + 先快照 | spec AC3 passed | PASS |
| WebDAV 字段冲突入副本 | sync-engine archiveConflictLayouts / webdav-field-conflict；spec AC-sync passed | PASS |
| i18n 7 键 + fallback | importMergeTitle 等在；**14/14 locale** | PASS |
| HTML 冲突行 | data-conflict-row / dataConflictArchived | PASS |
| cluster-map CM-1 | boxing-import-merge 已登记；guard violations:[] | PASS |
| **Playwright 导入合并** | 首脑实跑 **4 passed**：AC1+AC2 / AC3 / AC2-regression / AC-sync | **PASS** |
| 邻接回归 | data-recovery + migration-golden **9 passed** | PASS |
| node --check ×5 | OK | PASS |
| issues/44 | 4 项 [x]，Status done | PASS |

## 账本维度

报告无 A-xxx 序列；验收映射为 issue 4 项 + 设计决策 5 条，均有一一对应实物（函数/键/spec 用例）。无缺失。

## 过程违规

| ID | 内容 |
|---|---|
| 无新增 P0 | 绿跑已贴；追加式报告；未越权 |
| NOTE | 残红（title-select-all 等）已用「改动不存在的 CI run」基线定谳，非本票面——处理方式正确 |
| NOTE | 43R/42R/45R 仍待 land；44 依赖 43R 语义（已绿） |

## 裁决

**PASS** — 可 land。W3 解除。

---

## Frontier

```
DONE-CODE 待 land:
  42R · 43R · 45R · 44

W4 立即可开工（阻塞 40+42+45 中 40 已 land，42R/45R 已绿）:
  46  发行门禁 ADR-0017 + 检查单

发行红线:
  全量 CI 主 lane 残红清零或定谳豁免 + 人工 zip 黄金路径 + Pages 200
  之前禁止 tag / 禁止宣称可发行
```
