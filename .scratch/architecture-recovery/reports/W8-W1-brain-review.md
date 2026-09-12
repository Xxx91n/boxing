# Wave8 W1 首脑复核报告

> 日期: 2026-09-12 · 方法: 不信报告自述；磁盘/源码/守卫/issue 票面实物核验
> 用户路径备注: 消息中的 `64-report.md` 为 Wave7 遗留；本波 W1 = 票 70/74/75/77/79–86

## 0. 总门禁实测

| 门 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check` credentials/storage/settings-ui/sync-engine/ntp/background | **PASS** |
| import-graph | `node scripts/import-graph-guard.mjs` | **FAIL**（5 violations） |
| waiver-ledger | `node scripts/waiver-ledger-check.mjs` | **PASS**（2 rows, 0 expired, NQ clear） |
| docs pointers | `npm run docs:pointers` | **PASS**（74 pointers / 9 docs） |
| 候选包 | `D:/rel-2026.9.12` manifest + boot-theme | **PASS**（version=2026.9.12 双浏览器） |

### import-graph 违规（源码层）

1. **B-6 ×4** `ntp/credentials.js` L72/73/80/81 — `chrome.` / `browser.` 直访 storage，白名单仅 ntp.js / sync-engine.js / popups.js(openBookmarksInNewTabs)。票 81 重写引入。
2. **CM-1** `test/cluster-map.json` — `boxing-conflict-copy-readout.spec.ts` 未入任何 cluster。票 79 新增 spec 未登记。

---

## 1. 声明 → 证据 → 结论 对照表

| 票 | 报告声明（摘要） | 实物证据 | 结论 |
|---|---|---|---|
| 70 | 集合差+H1–H4 定谳完成；不改源码/台账 | `evidence/70-ci-logs/`、`70-set-diff-evidence.json/.md` 存在；issue AC 4/4 | **PASS-with-PV**（Status 仍 ready-for-agent） |
| 74 | 两条豁免复查；active 2→1 | WORKFLOW 台账 1 active + 1 closed；waiver-check OK；AC 3/3 | **PASS-with-PV**（Status 未翻 done） |
| 75 | 工件下载至 D:/rel-2026.9.12 | 目录+双 manifest version=2026.9.12+boot-theme 在；sha 文件在；AC 3/3 done | **PASS** |
| 77 | 慢放基础设施备好；不代理采集 | capture-card-chrome/firefox + notes + README 在；AC 仍 0/3 | **PASS**（agent 职责边界正确；**用户采集未做**，PV-W7-60-1 仍 open） |
| 79 | 冲突副本列表+导出已实现 | storage/settings-ui/i18n/14 locales/spec 均在；AC 3/3 | **FAIL 守卫**（CM-1）→ **返工 79R** |
| 80 | 方案先行零代码 | 报告在；无生产语义改动声明；AC 3/3 done | **PASS** |
| 81 | PIK v3 信封+迁移 | credentials.js 188 行含 boxingCredKey.v1/PBKDF2/AES-GCM/v:3；AC 4/4 | **FAIL 守卫**（B-6×4）→ **返工 81R** |
| 82 | 私网 opt-in 双层守卫+设置+i18n | `webdavAllowPrivateHost` 在 sync-engine/background/index.html；14 locales；README Privacy 改写；测试在 boxing-audit | **源码 PASS / 票面 FAIL**（issue AC 0/4、Status ready-for-agent，与报告「AC 四项全勾」矛盾） |
| 83 | 搜索 debounce 120ms | ntp.js cancel/flush/executeSearch 在；search spec debounce 命中；AC 3/3 done | **PASS** |
| 84 | terracotta→accent；4 项书面维持 | popup.css terracotta=0 a3513a=0 accent=8；AC 仍 0/3 | **源码 PASS / 票面 FAIL** |
| 85 | README 收敛+START-HERE+pointer check | START-HERE/checker 在；README Quarantined tests 无、.scratch=0；docs:pointers PASS | **PASS** |
| 86 | 61/63/64/66 关账 | issue AC 5/5、5/5、3/3、5/5 且 Status done | **PASS** |

---

## 2. A-xxx 账本维度

| A-xxx | 票 | 实现证据 | 缺失/弱化/跑偏 |
|---|---|---|---|
| A-025 | 70,74 | 定谳报告+台账处置 | Status 未翻转 |
| A-026 | 75 | 工件实物 | 无 |
| A-027 | 76/78 | 人工未开始 | 预期内 |
| A-028 | 77 | 基础设施 | 用户采集未做 |
| A-029 | 79 | 源码+spec | **cluster-map 未登记** |
| A-030 | 80 | 方案 | 无 |
| A-031 | 81 | 源码+文档 | **import-graph B-6** |
| A-032 | 82 | 源码+locale+README | **issue AC 未勾** |
| A-033 | 83 | 源码+测试 | 无 |
| A-034 | 84 | css 修复 | **issue AC 未勾** |
| A-035 | 85 | 文档+checker | 无 |
| A-036 | 86 | 票务关账 | 无 |
| A-037 | 70 | 协议遵守 | 无 |

---

## 3. 过程违规台账（不追认）

| ID | 描述 |
|---|---|
| PV-W8-70-1 | AC 4/4 已勾，Status 仍 ready-for-agent |
| PV-W8-74-1 | AC 3/3 已勾，Status 仍 ready-for-agent |
| PV-W8-79-1 | 报告验证清单未含 import-graph-guard；CM-1 红 |
| PV-W8-81-1 | 报告验证清单未含 import-graph-guard；B-6×4 红 |
| PV-W8-82-1 | 报告称 AC 四项全勾，issue 票面 0/4 且 Status ready-for-agent |
| PV-W8-84-1 | 报告称修复完成，issue 票面 AC 0/3 且 Status ready-for-agent |
| PV-W8-MSG-1 | 用户指示路径 `reports/64-report.md` 与本波 W1 票号不符（64 为 Wave7） |

---

## 4. Frontier 重算

| 类别 | 票 |
|---|---|
| **立即返工（源码守卫）** | 79R cluster-map · 81R credentials B-6 |
| **可开工（阻塞已解除）** | 71 N桶 · 72 B桶 · 73 boot-pending（均等 70 定谳，已交付） |
| **可开工（人工）** | 76 G-B（75 已完成）· 77 用户慢放采集 |
| **票面卫生** | 70/74 Status · 82/84 AC（不阻塞源码波） |
| **仍阻塞** | 78 #9 close ← 76 |

**宣布：W1 源码票不得按「全绿」计入 G-A；79/81 返工并重跑 import-graph 前，主 lane 守卫保持红。**
