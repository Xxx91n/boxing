# Report — Ticket 77: 60 慢放人工证据（Chrome+Firefox）

> 日期: 2026-09-12 · 覆盖 A-028（next-round T8 / backlog B41）· 分支: t77-slowmo-evidence
> 完成定义: 遵循 handoff 内的完成定义与 issue AC · 版本控制: 遵循 WORKFLOW §4.2 · 不 tag、不宣称可发行、不扩 ADR-0017、不进 G1–G6

## 本票性质（ready-for-human 的 agent 职责）

issue 77 Status: `ready-for-agent (ready-for-human; agent prepares/reviews only)` — 慢放证据由执行人（用户）在真浏览器采集，agent 职责 = 准备采集基础设施 + 对照票 60 AC 复核。本票不代理执行、不自动宣称证据成立（A-009 精神）。

## 交付物（4 文件，evidence/60-flash/）

| 文件 | 内容 |
|---|---|
| capture-card-chrome.md | Chrome 车道执行卡: 准备（2026.9.12 解包产物装载 + 记忆态基线）→ 路径 A Performance 帧步进 → 阳性对照（清镜像捕获 beige 降级帧）→ 路径 B 系统录屏真新开标签 → F1–F3 判定 → 落盘与处置 |
| capture-card-firefox.md | Firefox 车道同构执行卡（临时附加组件不重启注意 + 无截图轨道时以路径 B 为主） |
| capture-notes.md | 逐车道记录模板: F1–F3 各 PASS/FAIL + 阳性对照结果 + 逐帧发现明细 + 汇总（两车道全 PASS → AC 4 证据成立） |
| README.md | 更新 Status 节（票 77 基础设施已备 + 验收对象固定 run 34689649760）+ 采集流程摘要 + Files 清单 |

## 检查点: 对照票 60 AC（issues/60 七项）

本票专属验收 = 可关闭 PV-W7-60-1（「慢放证据弱」）。票 60 AC 4（Chrome+Firefox 慢放: 无默认 beige/无亮暗跳变/无非记忆盒子可见帧）的证据面由本票强化；其余六项已在 reports/60-report.md 验证，本票不重做、不回滚（红线: 零闪现不解耦记忆）。

### PV-W7-60-1 关闭条件（原证据缺口 → 本票补强）

| 缺口（W1 复核裁定） | 本票补强 | 关闭条件（执行人完成） |
|---|---|---|
| 原 evidence/60-flash 仅 README 采集步骤，无逐车道执行卡与记录模板，chrome/ firefox/ 两目录为空 | 双车道执行卡（含 2026.9.12 工件装载步骤 + F1–F3 逐帧断言标准）+ capture-notes.md 逐车道记录模板 | 执行人按卡采集: chrome/ 与 firefox/ 落入逐帧截图 + 阳性对照帧，capture-notes.md 两车道 F1–F3 全 PASS 回填 |
| 原步骤无方法灵敏度自证（阴性证据无对照不可信） | 阳性对照节: 清 boxingBootTheme.v1 → 刷新必须捕获 beige 降级帧（票 60 AC 5 降级路径），拍不到 beige = 方法无效，改以路径 B 为主 | 两车道阳性对照帧均落盘（positive-control-beige.png） |
| 原步骤未固定验收 build（CI-only 政策下"pending CI run"悬空） | 验收对象固定: 2026.9.12 候选工件 run 34689649760（含零闪现修复 898119eb）；红线 5: 勿复用 gb-2026.9.13 | capture-notes.md 回填解包路径与 build 来源 |
| 判定标准无帧边界定义（paint 前纯白帧误报风险） | 判定标准节: paint 前纯白/空白帧不算闪帧，已渲染出 beige/亮色背景才算 | capture-notes.md 逐帧明细按此边界记录 |

## AC 对照（issues/77 三项）

1. **两浏览器证据文件** → 部分就绪: 采集基础设施（双车道执行卡 + 记录模板）已落 evidence/60-flash/；chrome/ firefox/ 证据文件本体由执行人按卡落盘（ready-for-human，agent 不代理采集）。采集完成 + capture-notes.md 全 PASS 回填后本项勾选。
2. **README 记录结果** → README.md 已更新: Status 节记录采集基础设施就绪、验收对象固定 run 34689649760、ready-for-human 状态；采集完成后由执行人/收口窗在 capture-notes.md 汇总节记录最终结果并勾选本项。
3. **不进 G1–G6** → ✅ 本票全部文件在 evidence/60-flash/ 自建目录；未触碰 WORKFLOW §4.4 G-B 检查单、ADR-0017、豁免台账；采集卡首行铁律明示「本证据不进 G-B 六项、不进 ADR-0017 门禁」（票 60 spec D-003）。

## 红线遵守（next-round 8 条逐条）

1. 禁 tag/禁宣称可发行 → ✅ 本票无 tag、无 release 宣称。
2. 不扩 ADR-0017 → ✅ 未触碰。
3. 零闪现不解耦记忆；不回滚票 60 → ✅ 本票纯证据面，零源码改动；boot-theme.js/镜像语义未触碰。
4. N/B 禁豁免 → ✅ 未触碰豁免台账（waiver-ledger-check 不受影响）。
5. G-B 验收对象 = 2026.9.12 新 build 解包产物，勿用 gb-2026.9.13 → ✅ 采集卡铁律固定 run 34689649760。
6. G4/G5 基线只用 v2026.9.11 → ✅ 不涉及（本票无升级/回滚步骤）。
7. amo_sign=true / make_release=false → ✅ 未触发任何 build。
8. R8 卫生不升门禁 → ✅ 本票不升门禁。

## 调研来源（复用声明）

本票无新增联网调研。复用: (a) atomcode-ga-residual-research.md H1（boot-pending 遮罩/时序假说 — 采集卡路径 A 即对 H1 的人工帧级取证）；(b) reports/60-report.md（AC 5 降级路径 = 阳性对照设计依据；镜像语义 = 清镜像对照的可逆性依据）；(c) evidence/49-g-b-manual-golden-path/gb-execution-card.md（执行卡格式先例: 受众/铁律/准备/加载方式/证据命名）；(d) WORKFLOW §4.4 检查单（「无证据的勾选视同未勾」纪律沿用）。

## 版本控制

遵循 WORKFLOW §4.2: but diff 确认 → but commit -b t77-slowmo-evidence（evidence/60-flash 4 文件 + 本报告）；不 push、不开 PR、不动其他窗口未提交改动。

## 剩余动作（执行人）

1. `gh run download 34689649760 -n boxing-release-ubuntu-latest -D <固定目录>`（票 75/76 已建目录则复用）。
2. 按 capture-card-chrome.md 与 capture-card-firefox.md 各走一遍，落盘证据文件并回填 capture-notes.md。
3. 两车道 F1–F3 全 PASS → 勾选 issues/77 AC 1/2 + 关闭 PV-W7-60-1（收口窗执行）；任一 FAIL → 记录后回报大脑开缺陷票（不回滚票 60）。


---

## 用户强制通过（2026-09-12 · D-009 / A-038）

- 原文裁定: 「强制通过76 77不需要产物」
- 处理: issues/77 全部 AC 置 [x]，Status=done (user-forced, no artifacts)
- `evidence/60-flash/{chrome,firefox}` 仍不存在；无录屏/帧证据
- PV-W7-60-1 **不得**以「慢放证据已归档」名义关闭；仅可记「用户强制关闭票 77，证据未采集」
- 不进 G1–G6；不构成 ADR-0017 G-B
