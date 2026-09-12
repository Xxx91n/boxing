# Report — 86 票务/过程卫生（A-036 · Wave8 R8 · B40+B44）

- 日期: 2026-09-12
- 身份: Wave8 票 86 实施窗口（票务/过程卫生）
- 覆盖: A-036（D-007/D-008 R8 = 旧 B40 补勾 61/63/64/66 + 旧 B44 历史 AC 关账 51/54/59，B33 延续）
- 阻塞: None (can start immediately) — 满足，开工第一句已在窗口输出

## 1. 必读与调研

- 必读清单读毕: handoffs/86 · issues/86 · spec.md（Wave1/6/7/8）· WORKFLOW.md（§4.1/§4.2/§4.4/G-A 台账）· decision-ledger.md（A-001..A-037）· destination-reconciliation-wave8.md · docs/CONTEXT.md · AGENTS.md · wave8-release-grill/atomcode-ga-residual-research.md · handoffs/next-round.md。
- 调研协议 D-005: 本票为过程卫生票，**无新增调研问题**；复用既有分桶权威（票 70 终表 + atomcode-ga-residual-research）与 Wave6/7 首脑复核裁决（W6-W1/W2 · W1/W2-brain-review），逐项实测源码取证（不幻觉）。纯卫生票不发起 atomcode（票 15/64 先例）。与 current 决策**无冲突、无 revised**。

## 2. 方法（本票 delta：票面与源码一致再勾；专属验收：与 reports 对齐）

1. 以 issues/NN + reports/NN-report.md 为票面，先逐 AC 在当前工作树/main 提交态做**程序化实测**（grep/JSON 解析/git 锚点），再决定 勾选 / 注明 / 保持 open。
2. 三态纪律：
   - 票面=源码一致 → 勾选并内联实测注记；
   - 票面时点成立但后继票改变现场 → 按**票时点**勾选 + 注明后继去向（不追溯改写）；
   - 行为验收当前红且性质未定谳 → **不勾**，注明待哪张票定谳补勾（防假绿：绝不把 run 34686760142 的 N/B 桶红折算进卫生关账）。
3. 红线自检: 未改 ADR-0017、未改 WORKFLOW 门禁定义、未向豁免台账写入、未 tag、未宣称可发行、未动 decision-ledger.md 结算原文（并行窗共享文件，状态翻转归大脑）。

## 3. 关账明细

### 3.1 B40 — 61/63/64/66（PV 对应 issue：全勾 + Status done）

| 票 | AC | 实测证据（86 窗口） | 结果 |
|---|---|---|---|
| 61 | 徽章/声明改 v2026.9.11 | README 两徽章 + IMPORTANT 命中 v2026.9.11 | 勾 |
| 61 | 门禁语义 + draft/pre-release | README IMPORTANT + CHANGELOG [Unreleased] 头部在文 | 勾 |
| 61 | CHANGELOG v2026.9.11 条目 | "## [2026.9.11] - 2026-09-09" 存在 | 勾 |
| 61 | 无 2026.9.12/main ready-to-use 宣称 | README/CHANGELOG/docs/i18n README：ready-to-use 0、2026.9.12 0 | 勾 |
| 61 | ADR-0017 自检入报告 | reports/61 §ADR-0017 一致性自检 | 勾 |
| 63 | 诚实标注落地 | credentials.js + README Privacy + docs/privacy-policy.md 三处 | 勾 |
| 63 | per-install 分支 | 未采用（reports/63 §3 ADR-0017 回滚兼容理由） | 勾（N/A 注） |
| 63 | 措辞一致不伪称 | CRED_OBFUSCATION_SECRET×2 / CRED_APP_SECRET×0 / 字面量 intact；"user-provided password" 0 命中 | 勾 |
| 63 | 禁 passphrase/KDF | 零口令输入/KDF 参数变更 | 勾 |
| 63 | 不新增红 | reports/63 §6：node --check 0 + 守卫全绿 + cred-encrypt 双浏览器 5+5 | 勾 |
| 64 | Privacy 写明默认拒绝+原因 | main@db649204 README：host 全清单 + SSRF 原因 + unconditional refusal | 勾 |
| 64 | 不新增设置项（opt-in 后置） | 票时点 README 原文 "no setting to relax / opt-in deliberately deferred" | 勾（注明 opt-in 属票 82 后继 delta） |
| 64 | 与拦截范围一致 | AUD_PRIVATE_HOST_RE（sync-engine.js:35）/ BG_PRIVATE_HOST_RE+guardWebDAVRequest（background.js:71-95）实测在盘；逐 host 对照表在 reports/64 | 勾 |
| 66 | footer add 清除 | ntp/index.html footer 无游离 add（字节扫描 0 命中） | 勾 |
| 66 | syncProviderHint=local | index.html 内联 + i18n.js Fallback + 14 locale 全「本地存储」语义，sync storage 残留 0 | 勾 |
| 66 | __lastSaveError 净化 | storage.js stripGroupsForPersist + RUNTIME_ONLY_SETTING_RE=/^__/；sync-engine 导出/payload 走净化 | 勾 |
| 66 | 不清理重复 Fallback 键 | i18n.js 重复块零改动 | 勾 |
| 66 | 14 语言键完整性 | 14 份 messages.json 键集合完全相等（票 66 delta 时点各 241 键仅 value 变更；现 245 = +票 79/82 新键） | 勾（注明键数漂移归因） |

Status 翻转: 61/63/64/66 → done（票 86 关账注记 + PV 处置引用）。PV-W7-61/63/64/66-1 处置列已补记 docs/history/2026-09-12-wave7-closeout-backlog.md；PV-W7-60-1 保持 open（转票 77 人工慢放，本票不追认）。

### 3.2 B44（B33 延续）— 51/54/59 历史 AC 关账

**51（导出信封/RPO，a714de81 已 land）**: AC3 文件名、AC5 ADR-0009/0017、AC6 unwrapExportEnvelope → 3 项静态实证一致勾选；**AC1/AC2/AC4 保持未勾**，注明：对应 boxing-dr-export-envelope spec 在 main run 34686760142 首次 CI 即红（票 70 终表 N3/N4，性质=新增用例首红），修绿证据归票 71，绿证落地后补勾。Status: closed-pending-ga。

**54（continue-on-error 摘除）**: AC1 实测当前 test.yml continue-on-error/BOXING_EXCLUDE_GREP 均 0 命中且 data-golden job 保留为阻塞 → 勾；AC2 票时点绿证 run 34637028614（专用 job 7/7 + 主 lane 折入 14 全绿）→ 勾 + 注明 gate4 现回归红（N1）归票 71、不折算当前为绿；AC3 未逾期（09-12 < 09-18）→ 勾（N/A）。Status: done。

**59（空凭据冗余写，af415e93 已 land）**: AC1 定位、AC2 守卫落地（四路变化检测 + blur 无变化守卫实测在盘）、AC4 报告齐 → 勾；**AC3（不新增红）保持未勾**：票 70 终表 §3.1 将 conn-delete×4 persists-across-reload 真回归的**首要嫌疑**指向本守卫（去掉 unload 兜底写回），对照实验归票 72（T-GA3）定谳——嫌疑未洗清前不勾，防假账。Status: closed-pending-ac3。

**62（附带残留）**: 「有 →」分支 AC → 勾（N/A 注：仓库无既有正式声明，走「无」分支；W1 复核 "done 3/4 N/A 路径" 补记闭环）。

### 3.3 边界（不追认/不动的面）

- 更早票（01/04/06/08/16/17/34–37/40/47/49/57）的未勾 AC：不在 B33/B40/B44 具名范围；40/49/57 的未勾项为人工/到期型（G-B 本体、2026-10-12 复核），现状注明已成立，保持原样。
- 兄弟票 70–85 的 AC 面：归各自窗口，本票零触碰。
- ADR-0017、WORKFLOW §4.4、G-A 豁免台账：零 diff（本票 delta 仅 issues/*.md + backlog + 本报告）。
- codegraph sync（BX-EXPLORE-003）: 本票零源码改动，纯 markdown 关账，不适用。

## 4. 观察项（记录上报，不在本票处置）

1. **译文错字**：_locales/ar syncProviderHint「التشغين」疑应为「التخزين」；_locales/ko「선학하세요」疑应为「선택하세요」——均为票 66（f8556297）改值时引入/沿袭的文案缺陷，属用户可见面。修复涉 _locales（票 82/85 在途文件），建议随文档同步票处理，本票不改避免 hunk 纠缠。
2. **CI-only 政策偏差**：reports/63 §6 与 reports/66 V5/V6 存在本机 Playwright 运行记录，与 2026-09-04 用户指令「测试一律 CI」不符。仅登记供大脑复核，本票不处置（R8 禁升门禁）。
3. **键数漂移**：14 locale 由 241→245（票 79 冲突副本 + 票 82 opt-in 新键），键集合仍全等；后续 A7 校验继续兜底。
4. **worktree 现场**：票 82 的 README/index.html/i18n 改动已进 GitButler workspace（main 上 README 仍为票 64 原文）——本票对 64 的按票时点判定与之兼容。

## 5. 验证命令（可复核）

- 程序化断言 31 项（61/63/64/66/51/54/59 源码锚点 + 门禁文件零触碰），30 PASS；2 处初判 FAIL 经溯源修正：64a = worktree 含票 82 后继 delta（按票时点 main@db649204 复核通过）；66e = 译文字面不含英文 "local storage"（改按语义/键集合校验通过）。
- git diff --stat（本票 delta）：仅 .scratch/architecture-recovery/issues/{51,54,59,61,62,63,64,66,86} + docs/history/2026-09-12-wave7-closeout-backlog.md + 本报告。
- 全部写入文件：LF、无 BOM、字节完整性复核通过。

## 6. 完成定义自检

- [x] PV 对应 issue 勾选或注明（61/63/64/66 补勾 + PV 台账处置列；60-1 注明转票 77）
- [x] 不改 ADR-0017（零触碰；WORKFLOW/豁免台账同样零触碰）
- [x] 台账可审计（每个勾/不勾均有实测锚点或具名后继票；留 open 项全部注明补勾条件）
- [x] 报告落 reports/86-report.md · 版本控制遵循 WORKFLOW §4.2（but commit，不 push、不开 PR、不 tag）

## 7. 后续指向

- 票 71（T-GA2）修绿后：补勾 51 AC1/AC2/AC4 + 54 AC2 注记刷新（如需）。
- 票 72（T-GA3）定谳 conn-delete×4 后：裁决 59 AC3（洗清→补勾；成立→本头回炉修守卫，归大脑派单）。
- 票 77（P-HUM1）：PV-W7-60-1 的取证出口。
