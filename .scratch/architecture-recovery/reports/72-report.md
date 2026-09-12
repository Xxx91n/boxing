# 72 — G-A B 桶 broken 修绿

> 覆盖 A-xxx: A-025 · 阻塞: 70 ga-set-diff-root-cause（已满足）· 日期: 2026-09-12 · 状态: 实施完成
> 协议: D-005（调研 + ADR/CONTEXT 回顾 + 工业对标 + 冲突呈报）

---

## 0. 开工声明

1. **阻塞**: handoff 与 issue 均标注 blocked: 70 —— **满足**。issue 70 四条 AC 全勾、状态「定谳完成」，reports/70-report.md 已出具分桶终表（C run 唯一失败面 20 = N 5 + B 14 + B/F 1），并明确本票前置未改源码/豁免台账/产品行为。
2. **必读清单**: 7 项全读 — handoffs/72 · issues/72 · spec.md（Wave8 G-A 段）· WORKFLOW.md（§4.2 已提取）· decision-ledger.md（A-025/A-037 current）· destination-reconciliation-wave8.md（A-025 → issues 70–74）· docs/CONTEXT.md。
3. **补读**: reports/83-report.md §7.1（票 83 明确留给本票的 B3 search×2 根因线索）与 reports/70-report.md §3.1（增量窗口首要嫌疑人 af415e93）。

---

## 1. 面清单与本地复现

本地 chromium 基线（修复前，7 个 spec / 52 用例）：**14 failed / 38 passed**。

| # | spec | 面 | 修复前 | 修复后 |
|---|---|---|---|---|
| 1–4 | conn-delete-action | ctrl/shift/dbl/select+delete persists across reload | 红（0 → 1） | 绿 |
| 5–7 | innerclip | y=0 不被 head 覆盖 / 跨 zoom 不渐进裁剪 / title bar 不侵入 head | 红 | 绿 |
| 8 | innerclip-pan | pan 到 surface top 仍被 surface 裁剪 | 红 | 绿 |
| 9–10 | search | 大盒标题过滤 / 清空高亮 | 红（true/false → undefined） | 绿 |
| 11 | zoom-arrow | 进大盒后 inner zoom arrows | 红（true → false） | 绿 |
| 12 | popup-dragselect | 拖选结束弹层保持 | 红（element not found） | 绿 |
| 13 | empty-state | Bug5-dark bm-add-btn | 红（hover 断言） | 绿 |
| — | conn-delete | alt+click deletes the connection line | 红（browserType.launch 180s 超时） | 绿（环境性，见 §6） |

**面计数诚实标注**: 70 §4 写「B 14」，按其逐行清单相加为 13（4+4+2+1+1+1）。本窗口可复现实红 **13 面**，第 14 条本地失败为并发窗口抢资源导致的浏览器启动超时（非代码面，见 §6）。已按 70 的逐行清单验收，不按汇总数字冒领。

---

## 2. 根因定谳（三处，逐一实测）

### R1 — 卸载写回缺口：120ms 防抖写在 pagehide 前不落盘（conn-delete ×4）

**链路**: deleteConnById → removeConnection（内存生效，connCount 立即为 0）→ saveLayoutDebounced()（**120ms** 定时器）→ 用例 poll 到 0 后立即 page.reload()。

**为什么基线绿**: 票 59（af415e93）之前，pagehide → flushUnsavedCredentials() **无条件**执行 saveLayout()，把待落盘变更兜底写回；票 59 加入「凭据无变更即跳过」守卫后，这条兜底写回消失（该守卫本身是 42R 冗余写回的正解，不应回滚）。

**探针证据**（.scratch/architecture-recovery/_72-probe.cjs，已删除）：

- C2 显式 saveLayout 后: stored conns=1
- C3 ctrl+mousedown 删除后: connCount=0 / memConns=0 / **stored conns=1**（未落盘）
- C4 模拟卸载写回 saveLayout 后: stored conns=0
- C5 reload 后: **connCount=0**

即：只要在 pagehide 前把待定写回补上，删除即可持久化。补充实测：mergeConcurrentLayout 的 connections 走 mergeByIdUnion，无 id 字段的远端条目被过滤，因此补写不会把已删连接「union 回来」。

### R2 — 持久化 seam 名不副实：__boxingDebug.persistView() 不写 boxingLayout（8 面）

**事实**: persistView() 只调用 persistViewState(true)，后者只写 sessionStorage / localStorage 的**视图状态**键，从不写 boxingLayout。innerclip ×3、innerclip-pan、search ×2、zoom-arrow(inner)、popup-dragselect 这 8 面全部是「经 __boxingDebug.layout 播种 → persistView() → reload」，播种必然丢失。

**基线绿的原因**: 同上 —— 票 59 之前的无条件卸载 saveLayout 意外承担了这个 seam 的持久化职责（票 83 reports §7.1 已独立观测到「reload 后 boxes=[]」并点名归本票）。

**探针证据**: 播种 1 个盒 → persistView() → localStorage boxingLayout boxes=**0** → reload 后 memBoxes=[] / domBoxes=[]。

### R3 — Bug5-dark 是 transition 竞态，不是 CSS 缺陷（1 面）

**实测**: .bm-add-btn 的 background 走 transition（--dur-fast = 140ms）。用例在 page.hover 同一轮同步读 getComputedStyle，采到的是过渡**起始值** rgba(0,0,0,0)；等 500ms 后为 rgba(191,160,117,0.12) = --color-accent-soft，与 probe 值一致。

**结论**: 失败的是「hover 断言」（Expected accent-soft / Received transparent），不是「基础透明断言」—— 后者一直是绿的。CSS 契约本身成立，旧读法是在过渡中途取样。

---

## 3. 修复

| 根因 | 改动 | 文件 |
|---|---|---|
| R1 | 新增 flushPendingLayoutSave()：仅当 saveDebounceTimer 挂起时清定时器并立即 saveLayout()；挂接到 pagehide / beforeunload / visibilitychange=hidden 三条既有卸载路径 | ntp/ntp.js |
| R2 | __boxingDebug.persistView() 改为 return saveLayout()（saveLayout 内部已调用 persistViewState(true)，是原行为的严格超集；返回 promise 让调用方可 await 持久化） | ntp/ntp.js |
| R3 | hover 断言改为 expect.poll 等过渡落定；断言语义不变（dark :hover 仍须绘制 --color-accent-soft） | test/tests/boxing-empty-state-buttons.spec.ts |

**为什么放在 ntp.js 而不是 storage.js**：storage.js 正被票 71（N 桶 data-golden gate4）并行修改。本票初版曾把 flush 写进 storage.js，发现该文件混有他窗未提交 hunk 后**主动撤回**，改为在 ntp.js 内用 state.js 的 saveDebounceTimer / setSaveDebounceTimer 活绑定实现 —— 提交面收敛到本票独占的文件，不误吞他窗工作（票 83 报告 §8 同款教训）。

**明确未采用的两个方案**：

1. **恢复无条件卸载 saveLayout()** —— 那是票 59 修掉的 42R 冗余写回根因，回滚即重写缺陷。
2. **lastPersistedJson 差异比对** —— saveLayout 成功后 gcTombstones 仍会改 layout._meta.deleted，下一次卸载必然判定「已发散」，等价于无条件写回，同样退化。

---

## 4. 验证

| 项目 | 命令/范围 | 结果 |
|---|---|---|
| B 桶 chromium（修复前） | 7 spec / 52 用例 | 14 failed / 38 passed |
| B 桶 chromium（修复后） | 同上，--workers=2 | **52 passed** |
| B 桶 firefox（修复后，专属验收抽样） | 同上，--workers=2 --timeout=180000 | **52 passed** |
| 重构后 B 桶 chromium 复跑 | 同上 | **52 passed** |
| 重构后 B 桶 firefox 复跑 | 同上 | **52 passed** |
| 持久化邻域回归（14 个 spec / 99 用例） | conn-persist / connections / conn-dsu / settings-persist / viewstate-sync / snapshot-rotation / onboarding / auto-expand / zoom-dblclick / time-machine-rollback / migration-golden / update-cow-before-migrate / debug / memory | **99 passed** |
| node --check | ntp/ntp.js · ntp/storage.js | exit 0 |
| import-graph-guard | node scripts/import-graph-guard.mjs | ok，15 modules / 48 edges / 0 violations |
| git diff --check | — | 干净（无 CRLF 引入） |
| 全量套件（单浏览器） | 44 spec / 285 用例，--workers=2 | **280 passed / 1 skipped / 4 failed**（4 红全部非本票，见 §4.1） |

### 4.1 全量残红归因（逐条取证，不冒领、不甩锅）

| 残红用例 | solo 复跑 | 归因 | 是否本票 |
|---|---|---|---|
| data-golden gate 2 — single write path | **仍红（确定性）** | 扫描报 `ntp/credentials.js return api.storage.local.set(obj);` —— 票 81（per-install key）在 credentials.js 直写 chrome.storage.local 键 boxingCredKey.v1；81R 只放宽了 import-graph-guard 的 B-6，未同步 data-golden gate 2 白名单 | **否**，属 N 桶/票 81R 遗留 |
| data-golden gate 5 — near-full storage | **绿** | 并发窗口争用 | 否（环境性） |
| star-sync Scenario 1 | 未 solo（70 已列 N?） | 70 §4 列为「N? star-sync（建议 NQ 评估）」，属票 71 面 | **否**，属 N? 桶/票 71 |
| webdav — test button shows error message on failure | **绿** | 并发窗口争用 | 否（环境性） |

**结论**: 全量 4 红中 0 条由本票引入；本票 13 面在全量跑中仍全绿。

---

## 5. 与 current 决策的关系

- **无冲突、无 revised**。A-025（N/B 禁豁免、禁假绿、不改 ADR-0017、不回滚零闪现）、A-008（修绿优先）、A-037（D-005 调研协议）全部被服从。
- **未向豁免台账加任何 broken 行**，未动 waiver ledger。
- 未扩 ADR-0017、未新增 G-D、未 tag、未宣称可发行。
- 对 70 §4 的一处**计数修正建议**（非改向，附推导）：70 写「N 5（含 N? 1）+ B 14 + B/F 1 = 20」。按其 §2 逐行清单重算：增量 17 面中 B = conn-delete 4 + innerclip 4 + popup-dragselect 1 + search 2 + zoom-arrow 1 = **12**；存量 3 面中 B = Bug5-dark **1**。故 **B = 13**；而 N = 增量 data-golden 1 + dr-export 3 + star-sync 1 = 5，加存量 state-sync 1 → **N = 6**。即正确分解为 **N 6 + B 13 + B/F 1 = 20**，70 把 star-sync/state-sync 的归属与 B 的合计各偏了 1。本票按逐行清单（B 13）验收，不按汇总数字冒领，也不替 N 桶销账。

---

## 6. 环境性失败（诚实标注，未计入本票红面）

基线本地跑中 conn-delete 的「alt+click deletes the connection line」以 browserType.launch Timeout 180000ms 失败 —— 与票 83 报告 §6 记录的同类现象一致（并发窗口抢宿主资源），修复后同批直接通过。CI（2 workers、标准 runner）历史上这条例也未进 B 桶清单，判定为宿主环境性。

---

## 7. 发现但未修（不扩本票面）

1. **真实产品缺口（R1 的同源问题）**: 真实扩展车道下 pagehide 的异步 chrome.storage 写不保证完成，本次修复在 file:// mock 车道（localStorage，微任务内完成）已被验证；真车道若需同样保证，应另立票评估 navigator.sendBeacon 式同步通道或 storage.session 镜像。
2. **mergeByIdUnion 依赖 id 字段**: connections 合并走 union 且按 id 去重，无 id 的条目会被静默丢弃。本票依赖该行为达成「删除不被 union 复活」，但它本身是隐式契约，建议大脑另立小票显式化。
3. **docs/CONTEXT.md 待补一行**: 建议补「__boxingDebug.persistView() = 布局 + 视图状态落盘（票 72）」。本窗口未改该文件（正被并行窗口占用）。

---

## 8. 版本控制（WORKFLOW §4.2）

- 独立分支提交，逐 hunk 认领：仅提交 ntp/ntp.js（全部属本票）与 test/tests/boxing-empty-state-buttons.spec.ts；**ntp/storage.js 的票 71 hunk 原样保留、未纳入本票提交**。
- 不 push、不开 PR、不改写他窗提交；不 tag、不宣称可发行。
