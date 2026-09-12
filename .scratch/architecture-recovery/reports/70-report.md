# 70 — G-A 集合差与根因定谳（H1–H4）

> 覆盖 A-xxx: A-025, A-037 · 阻塞: None（已满足）· 日期: 2026-09-12 · 状态: 定谳完成
> 协议: D-005（atomcode 深度调研 + ADR/CONTEXT 回顾 + 工业对标 + 冲突呈报）

---

## 0. 开工声明

1. **阻塞**: handoff 与 issue 均标注 `blocked: None (can start immediately)` — **满足**。
2. **必读清单**: 7 项全读（handoffs/70 · issues/70 · spec.md · WORKFLOW.md · decision-ledger.md · destination-reconciliation-wave8.md · docs/CONTEXT.md），另补读 handoff 附加项 `atomcode-ga-residual-research.md`（H1–H4 源）与 `next-round.md`（T1）。
3. **本票未改任何源码、未改豁免台账、未改产品行为**（AC4 满足）。产物仅：证据 + 本报告。

---

## 1. 方法

| 项 | 值 |
|---|---|
| 数据源 | GitHub Actions job 日志 7 份，全量落盘 `evidence/70-ci-logs/` |
| run A（基线） | **34626507101** · head `ffa55f8c`（票 44）· 2026-09-11T17:13Z |
| run B（中间） | **34672647167** · head `af415e93`（票 59）· 2026-09-12T04:18Z |
| run C（目标） | **34686760142** · head `f8556297`（票 66）· 2026-09-12T09:47Z |
| 提取方式 | 程序化解析 Playwright 汇总块（`N failed` / `N flaky` 后缩进 `[project] ›` 行），非人工摘抄 |
| 归一化 | 剥离 `[chromium-extension]/[firefox-extension]` 前缀与 `file:line:col`，Windows 反斜杠归一为 `/`；跨 OS × 浏览器合并为唯一「面」 |
| 可复现 | `evidence/70-set-diff-evidence.json` + `.md`（逐面三向矩阵 + 错误签名） |

**规模对照（每 OS 主泳道）**

| run | failed | flaky | skipped | passed | 合计 |
|---|---|---|---|---|---|
| A 基线 | 8–10 | 0–2 | 3 | 496–497 | ~510 |
| B 中间 | 36–37 | 0–2 | 5 | 506–509 | ~550 |
| C 目标 | 36–37 | 1 | 5 | 507–508 | ~550 |

---

## 2. 集合差总表（核心交付）

**唯一失败面：A = 8 · B = 20 · C = 20。**

- **增量（仅 B/C 有、A 无）= 17 面**
- **存量（A/B/C 全有）= 3 面**
- **消失（仅 A 有）= 5 面**
- **B 与 C 的失败面集合完全相等（程序化判定 `midEqualsNew = true`）**

### 2.1 增量 17 面（全部 macos+ubuntu+windows × chromium+firefox 一致）

| # | spec | 面 | Expected → Received | 性质 |
|---|---|---|---|---|
| 1–4 | conn-delete-action | ctrl/shift/dbl/select+delete **persists across reload** | 0 → 1 | 既有用例·真回归 |
| 5 | data-golden | gate4 跨页 revision 收敛 | 3 → 4 | 既有用例·真回归（专用 job 由绿转红） |
| 6–8 | dr-export-envelope | AC1+AC3 信封 / AC2 全量包 / AC4 WebDAV cloud-newer | 1→0 / 1→0 / "pull"→"merge" | **票 51 新增用例·首次 CI 执行即红** |
| 9–12 | innerclip ×3 + innerclip-pan | y=0 裁剪/可见性契约 | true → false | 既有用例·真回归 |
| 13 | popup-dragselect | 拖选结束弹层保持 | visible → element not found | 既有用例·真回归 |
| 14–15 | search ×2 | 大盒标题过滤 / 清空高亮 | true/false → undefined | 既有用例·真回归 |
| 16 | star-sync-audit | Scenario 1 跨标签 isParent | true → null | 既有用例·真回归 |
| 17 | zoom-arrow | 进大盒后箭头尺寸 | true → false | 既有用例·真回归 |

### 2.2 存量 3 面（A/B/C 三 run 全红）

| spec | 面 | 备注 |
|---|---|---|
| state-sync | 双标签并发创建收敛（2 → 1） | N2；票 48 声称修绿**未成功** |
| empty-state-buttons | Bug5-dark bm-add-btn 透明（`rgba(196,168,130,0.12)` → `rgba(0,0,0,0)`） | B6；票 48 声称修绿**未成功** |
| auto-expand | 大盒回访后 --expand-height（>80 → 60） | B8/F2；台账已有 active 豁免（chromium） |

### 2.3 消失 5 面（仅基线有）

- `title-select-all` ×3（票 48 修绿成功，三 OS 全清）
- `snapshot-rotation`（macos 单面，票 48 归因于 t50 `_lastSnapTs`）
- `zoom-dblclick`（windows 单面）

### 2.4 专属验收：三个点名面的性质互不相同

| 面 | 是否增量 | 判定依据 |
|---|---|---|
| **data-golden** gate4 | **是（真回归）** | 基线专用 data-golden job **success** → B/C **failure**；基线主泳道因 `BOXING_EXCLUDE_GREP=@data-golden` 未执行该 spec，故「基线绿」只能由专用 job 证明 |
| **state-sync** 并发 | **否（存量）** | A/B/C 三 run 三 OS 全红，非本窗口引入 |
| **dr-export** AC1/AC2/AC4 | **是，但非回归** | `boxing-dr-export-envelope.spec.ts` 为票 51（`a714de81`）**新增文件**（+270 行 / 11 用例），基线不存在；首次进 CI 即红，属「新增用例首红」而非「回归」 |

> **对分桶的修正建议**：atomcode 报告 §2 将 N4（dr-export AC1/AC2）列为「建议升格 NQ」，正确；但应**追加性质标签**，把「新增用例首红」与「回归红」分开 —— 两者在 T-GA2 的修绿策略上不同（前者是功能未达标，后者是既有契约被打破）。

---

## 3. H1–H4 定谳

| ID | 假说 | 裁决 | 证据 |
|---|---|---|---|
| **H1** | 票 60 `html.boot-pending` 遮罩/时序导致 e2e 在 unmask 前取样 | **否证**（对增量面） | ① 时间序：17 个增量面在 **B（`af415e93`，04:18）已全红**，票 60（`898119eb`）在其后 land；② 集合序：**B ≡ C**，票 60 落地后失败面零增零减；③ 票 60 只触及 `render.js`/`base.css`/`boot-theme.js`，不在 innerclip/search/conn-delete 断言路径上 |
| **H2** | 存量 broken 面（票 48 只修部分 + Bug5-dark 再现） | **部分成立** | 支持：state-sync / Bug5-dark / auto-expand 三面 A/B/C 全红，票 48 自述且未修成。**不足以解释 17 面增量**（覆盖面 3/20） |
| **H3** | data-golden gate4（B45）由 flaky 升级为稳定红 | **成立** | 专用 job：基线 **success** → B **failure** → C **failure**；主泳道三 OS 全红且 **failed 与 flaky 并存**（windows firefox 记 flaky），符合「同代码不同结果 → 竞态升级」，与 revision 收敛语义（3→4）吻合 |
| **H4** | 票 66 `RUNTIME_ONLY_SETTING_RE` 净化意外影响 e2e | **否证**（对增量面） | ① 时间序：17 面在票 66 前已红；② 集合序：**B ≡ C**，票 66 落地后失败面零增零减；③ 票 66 自述「残红经还原对照实验证明与本票无因果」获**独立复核支持**（本票用第三方 CI 集合相等性复核，不依赖其自证） |

### 3.1 结论：增量根因窗口

17 面增量**全部**产生于开区间 `(ffa55f8c, af415e93]`。该区间内源码改动提交共 6 个：

| 提交 | 票 | 改动面 |
|---|---|---|
| `a714de81` | 51 | `storage.js` `sync-engine.js` `settings-ui.js` `utils.js` `ntp.js` `index.html` + 新增 dr-export spec |
| `7c4d445f` | 50 | `storage.js`（`saveSnapshot(reason)` + `_lastSnapTs` + `replaceLayoutFromRestored`）`settings-ui.js` `index.html` |
| `bc67314e` | 48 | `storage.js`（`applyExternalLayout` try/finally 全包裹） + 5 个 spec |
| `1113e5d5` | 53 | 仅构建期 CSS 门禁 |
| `0025da17` | 54 | 仅 CI：移除 `continue-on-error` 与 `BOXING_EXCLUDE_GREP`（**唯一可解释 data-golden 进入主泳道**，仅 1 面） |
| `af415e93` | 59 | `sync-engine.js` 空凭据无变更守卫 |

**首要嫌疑人（未定谳，机制高度吻合）**：`af415e93`（票 59）在 `flushUnsavedCredentials` 与 `blur` 路径加入「无变更即跳过 `saveLayout()`」守卫，去掉了 **pagehide/beforeunload 的兜底落盘写回**；conn-delete 四面断言形状为「删除已生效（poll 到 0）→ reload → 期望 0 收到 1」，即**待落盘变更在 reload 时丢失**，与该守卫的因果链对齐。需 T-GA3 本地单跑（加/去守卫对照）定谳。

### 3.2 信息缺口（诚实标注）

- **窗口内无法再二分**：32 个提交在 04:16–04:18 两分钟内批量推送，Test workflow 因并发取消仅 `af415e93` 一次跑完（`91af289a`/`45c226b1`/`3decb62a`/`8dc19acd` 的 Test run 均为 cancelled）。**per-commit 二分需本地执行**，CI 证据到此为止。
- 本报告未做本地 `npm test`（与 atomcode 报告 §6 同一缺口，按 D-005 归属实施票）。

---

## 4. 分桶终表（G-A 治理用）

> NQ 正则：`data-golden|migration-golden|update-cow|snapshot-rotation|state-sync|data-recovery|import-merge|webdav|sync-ui|boxing-sync`

| 桶 | 面 | 数 | 性质 | 处置 |
|---|---|---|---|---|
| **N** | N1 data-golden gate4 | 1 | 真回归 + flaky 升级 | 修绿；**禁豁免** |
| **N** | N2 state-sync 并发 | 1 | 存量未修 | 修绿；**禁豁免** |
| **N** | N3 dr-export AC4（webdav） | 1 | 新增用例首红 | 修绿；**禁豁免** |
| **N** | N4 dr-export AC1+AC3 / AC2 | 2 | 新增用例首红 | 修绿；建议正式升格 NQ；**禁豁免** |
| **N?** | star-sync Scenario 1（建议 NQ 评估） | 1 | 真回归 | 先定 N/B 再修；**禁豁免** |
| **B** | conn-delete ×4（persists across reload） | 4 | 真回归 | 修绿；**禁豁免**（三 OS × 双浏览器一致 = broken） |
| **B** | innerclip ×3 + innerclip-pan | 4 | 真回归 | 修绿；**禁豁免** |
| **B** | search ×2 | 2 | 真回归 | 修绿；**禁豁免** |
| **B** | zoom-arrow | 1 | 真回归 | 修绿；**禁豁免** |
| **B** | popup-dragselect | 1 | 真回归 | 修绿；**禁豁免** |
| **B** | empty-state Bug5-dark | 1 | 存量未修（票 48 未修成） | 修绿；**禁豁免** |
| **B/F** | auto-expand（台账 active 豁免 chromium） | 1 | 存量 + 抖动 | T-GA5 复查签名与到期；**不得凭 1 条豁免折算** |

**合计：C run 唯一失败面 20 = N 5（含 N? 1）+ B 14 + B/F 1。**

**与豁免台账的关系**：台账仅 2 条 active（auto-expand chromium、zoom-dblclick firefox）。除 auto-expand 外，**19 面均不在合法豁免范围内**；N 桶 5 面命中 never-quarantine 正则，`waiver-ledger-check.mjs` 会 exit≠0。
**「2 条 active 豁免折算 37 红为绿」在本票证据下不成立**（与 W8 D-006 / A-008 一致）。

---

## 5. 与 current 决策的关系

- **无冲突、无 revised。** A-025（N/B 禁豁免、禁假绿）、A-008（修绿优先、数据完整性永不豁免）、A-037（D-005 调研协议）、ADR-0017（G-A∧G-B∧G-C）全部被**服从**，未改写。
- 本票**不扩 ADR-0017、不新增 G-D、不回滚零闪现、不改豁免台账** —— H1 否证意味着票 73（T-GA4）**当前无触发条件**，不应启动。
- 对 spec Wave8 的一处**措辞修正建议**（非改向）：`票 73 仅当 H1` 应追加「H1 已否证 → 票 73 暂挂；若 T-GA3 证明 conn-delete 面属卸载写回时序，应另立票而非复用票 73（票 73 绑定零闪现）」。

---

## 6. 交付物

| 路径 | 内容 |
|---|---|
| `.scratch/architecture-recovery/reports/70-report.md` | 本报告 |
| `.scratch/architecture-recovery/evidence/70-set-diff-evidence.md` | 逐面三向矩阵 + 错误签名 |
| `.scratch/architecture-recovery/evidence/70-set-diff-evidence.json` | 机器可读（per-job 汇总 + rows + `midEqualsNew`） |
| `.scratch/architecture-recovery/evidence/70-ci-logs/` | 7 份原始 job 日志 + `parsed-summary.json` |

## 7. 后续指向

- **T-GA2（N 桶）**：data-golden gate4 优先 —— 唯一「专用 job 由绿转红」的真回归，且是发行阻断面。
- **T-GA3（B 桶）**：建议**先做 conn-delete 卸载写回守卫对照实验**（首要嫌疑人），再做 innerclip/zoom-arrow 几何面。
- **T-GA4（票 73）**：H1 否证 → **暂挂**；仅在 T-GA3 证明系首帧时序时才重启，且不得回滚零闪现。
- **T-GA5（票 74）**：auto-expand 单跑 + zoom-dblclick 到期复查（后者本票已在 C run 消失）。

## 8. 版本控制

遵循 WORKFLOW §4.2：`but diff` 确认改动 → `but commit -b <branch> -m "<消息>" <改动id...>`。不 push、不开 PR、不 tag。
