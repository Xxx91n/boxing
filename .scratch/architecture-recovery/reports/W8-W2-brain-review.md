# Wave8 W2 首脑复核报告

> 日期: 2026-09-12 · 范围: 79R / 81R / 71 / 72 / 73 / 76 / 77
> 方法: 磁盘+源码+守卫+Playwright 实测；不信报告自述
> 路径备注: 消息中 `64-report.md` 仍为 Wave7 遗留；本波报告为 71/72/73/76/77/79/81-report.md

## 0. 总门禁实测

| 门 | 命令/方法 | 结果 |
|---|---|---|
| import-graph-guard | `node scripts/import-graph-guard.mjs` | **PASS**（0 violations） |
| node --check | credentials/storage/settings-ui/ntp/background | **PASS** |
| data-golden gate 2 | `playwright -g "gate 2"` chromium-extension | **FAIL** |
| waiver-ledger | （W1 已 PASS，本波未改台账） | PASS |
| 候选包 | D:/rel-2026.9.12 | PASS |

### gate 2 失败签名（实测）

```
direct storage writes outside the facade:
ntp/credentials.js return api.storage.local.set(obj);
```

成因：票 81 PIK 在 credentials.js 直写 `storage.local`（键 `boxingCredKey.v1`，非 layout）。票 71/72 已裁定交 81/81R；**81R 只修了 import-graph B-6，未修 gate2**。

---

## 1. 声明 → 证据 → 结论

| 票 | 声明 | 实物证据 | 结论 |
|---|---|---|---|
| **79R** | cluster-map 登记；CM-1 转绿 | import-graph 0 违规；`boxing-conflict-copy-readout.spec.ts` ∈ ntp/storage.js cluster；AC 4/4；返工节已追加 79-report | **PASS** |
| **81R** | B-6 条件白名单；守卫绿 | guard 对 credentials.js 条件放行已写入 import-graph-guard.mjs；import-graph PASS；AC 4/4 | **PASS（守卫面）** / **gate2 面未闭环** |
| **71** | N 三面修绿；job 内 gate4 绿、gate2 跨票未绿 | storage.js 有 stableJson/canonicalReplicated/preserveUpdatedAt；报告诚实标注 gate2 未绿；issue AC 4/4 **含「job 与主 lane 同绿」** | **部分 PASS**：N1–N4 源码在；**专属验收未齐**（gate2 仍红）→ 票面 overclaim |
| **72** | B 13 面修绿；flushPendingLayoutSave + persistView=saveLayout + poll | ntp.js L1086–1092 flushPendingLayoutSave **且** pagehide/visibilityhidden/beforeunload 均调用它；persistView() → saveLayout()；empty-state spec 在 | **PASS（B 面）**；gate2 残红归 81 非本票 |
| **73** | H1 否证 → 书面 N/A；不回滚 boot-theme | boot-theme.js 121 行仍在；AC 3/3；报告 N/A 论证完整 | **PASS-with-PV**（Status 仍 ready-for-agent） |
| **76** | 人工 G-B；agent 只备卡/预检 | checklist-2026.9.12 双车道已建；dry-run 脚本明确「非 G-B 证据」；AC 前三项 ☐ | **PASS（agent 边界）**；**G-B 本体未完成** |
| **77** | 慢放基建；不代理采集 | capture-card 双车道+notes 在；evidence/60-flash/chrome|firefox **仍无采集文件**；AC 0/3 | **PASS（agent 边界）**；**用户采集未做** |

---

## 2. A-xxx 账本维度

| A-xxx | 票 | 证据 | 缺口 |
|---|---|---|---|
| A-025 | 71,72,73 | N/B 修复代码在；H1 N/A | **data-golden job 仍红（gate2）** |
| A-026 | 76 | 包+清单 | G-B 六项未勾 |
| A-027 | 76 | 基线卡已绑 2026.9.12 / v2026.9.11 | G4/G6 未完成 |
| A-028 | 77 | 基建 | 用户证据文件缺失 |
| A-029 | 79/79R | 源码+cluster | 无 |
| A-031 | 81/81R | PIK v3 + B-6 白名单 | **gate2 扫描仍红** |
| A-037 | 71–73 | 协议遵守 | 无 |

---

## 3. 过程违规（不追认）

| ID | 描述 |
|---|---|
| PV-W8-71-1 | issue AC 含「data-golden job 与主 lane 同绿」且 Status done，但 gate2 实测仍红 |
| PV-W8-81R-1 | 返工只闭环 import-graph B-6，未处理 71/72 移交的 gate2 single-write-path（用户曾裁定交 81/81R） |
| PV-W8-73-1 | AC 3/3 已勾，Status 仍 ready-for-agent |
| PV-W8-MSG-1 | 用户路径仍写 64-report.md（Wave7） |

**边界正确（非违规）**：76/77 未代理人工步骤、未宣称 G-B/慢放完成、未打 tag。

---

## 4. Frontier

| 优先级 | 项 |
|---|---|
| **P0 返工** | **81R2**：修 data-golden gate2（PIK 写路径合规） |
| **P0 人工** | **76** G-B 六项 · **77** 用户慢放采集 |
| **P2 卫生** | 71 AC 收窄/注明 gate2 移交 · 73 Status → done(N/A) |
| **可并行源码** | 78 等 76；82/84 AC 卫生（W1 残留） |
| **发行** | gate2 绿 + G-A CI 复跑 + G-B 完成前 **禁 tag** |

**宣布：79R/81R 守卫面已闭环；G-A 在 gate2 与 main 全量 CI 复跑前仍不可宣称绿。**
