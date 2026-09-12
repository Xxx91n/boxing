# 73 — boot-pending × e2e 就绪契约（仅 H1）

> 覆盖 A-xxx: A-025 · blocked: 70 ga-set-diff-root-cause（已满足）· 日期: 2026-09-12 · 状态: **H1 否证 → 书面 N/A**，专属验收实测通过
> 协议: D-005（atomcode 调研 + ADR/CONTEXT 回顾 + 工业对标 + 冲突呈报）

---

## 0. 开工声明

1. **阻塞是否满足**：满足。票 70 报告已落盘，状态「定谳完成」。
2. **必读清单**：7 项全读（handoffs/73 · issues/73 · spec.md · WORKFLOW.md · decision-ledger.md · destination-reconciliation-wave8.md · docs/CONTEXT.md）。另补读阻塞源 reports/70-report.md、prompts/70、atomcode-ga-residual-research.md（H1–H4 源）、next-round.md（T4 定义）、reports/60-report.md（boot-pending 机制交付面）。
3. **本票未改任何源码、未改测试、未改豁免台账、未改产品行为**。产物仅：证据 + 本报告 + issues/73 AC 勾选。
4. **未触碰 spec.md / decision-ledger.md / docs/CONTEXT.md**：三者在当前工作区均有并行窗口的未提交改动，本票只呈报、不落笔（见 §6）。

---

## 1. 核心结论：H1 否证 → 本票书面 N/A

票 70 §3 对 H1 的裁决为**否证**，三重证据：

| 证据 | 内容 |
|---|---|
| 时间序 | 17 个增量失败面在 run B（af415e93，04:18）**已全红**，票 60（898119eb）在其**之后** land |
| 集合序 | B ≡ C（程序化判定 midEqualsNew = true），票 60 落地后失败面**零增零减** |
| 路径 | 票 60 仅触及 render.js / base.css / boot-theme.js，不在 innerclip / search / conn-delete 断言路径上 |

按 issues/73 定义「仅当 H1 成立：对齐 e2e 就绪或 unmask 时序；**H1 否则书面 N/A**」，本票实施面（对齐 e2e 就绪 / 改 unmask 时序）**无触发条件，不执行**。票 70 §5 与 §7 亦明确「票 73 当前无触发条件，不应启动」「T-GA4：H1 否证 → 暂挂」。

### 1.1 逐条 AC 对照

| # | AC | 判定 | 依据 |
|---|---|---|---|
| 1 | 70 写明 H1 成立或 N/A | **勾** | 70 §3 表格 H1 行明确「否证（对增量面）」+ §7 T-GA4「H1 否证 → 暂挂」= 书面 N/A |
| 2 | 成立则可见性面恢复绿且首帧无默认主题闪现 | **N/A（不适用）** | H1 否证，「成立则」分支不触发。**但本票仍做运行时实测，首帧无默认主题闪现成立**（见 §3），属超额证据，不计入 G-A 门禁 |
| 3 | 不回滚 boot-theme 机制 | **勾** | 4 处代码锚点全部在位（§2.1）+ 运行时验证通过（§3）。本票未改任何源码 |

---

## 2. 检查点：禁止删除 boot-pending 修测试

### 2.1 机制完整性（未被回滚）

| 锚点 | 位置 | 状态 |
|---|---|---|
| 遮罩挂上 | ntp/boot-theme.js:25 | 在位 |
| 4s failsafe 兜底摘除 | ntp/boot-theme.js:120 | 在位 |
| renderCanvas 完成摘除 | ntp/render.js:382 | 在位 |
| _enterLargeBox 完成摘除 | ntp/render.js:710 | 在位 |
| 遮罩 CSS 规则 | ntp/base.css:1244-1246、ntp/ntp.css:1244-1246 | 在位 |
| 镜像键读点 | boot-theme.js KEY = boxingBootTheme.v1 | 在位 |

### 2.2 测试检索结果（诚实标注）

| 检索 | 范围 | 结果 |
|---|---|---|
| boot-pending / boot-theme / zero-flash 用例 | grep 递归扫 test 下全部 .ts | **0 命中** |
| 文件名含 flash/theme/boot 的 spec | test/tests/ 共 46 个 spec | 仅 boxing-accent-theme.spec.ts，内容为 ADR-0012 主题包按钮点击，**不涉 boot-pending** |
| 历史是否删除过 | git log --all --diff-filter=D 过滤 flash/theme/boot | **0 命中 = 从未删除** |
| 历史是否曾存在 | git log --all --name-only 过滤 flash/theme/boot | 仅 boxing-accent-theme.spec.ts，**从未存在 boot-pending 专项测试** |

**结论**：检查点「禁止删除 boot-pending 修测试」在本仓库属**无可删对象** —— 票 60 从未交付 boot-pending 专项 e2e 用例。票 60 报告「验证（命令可复核）」一列仅含静态校验：node --check 5/5、import-graph-guard 0 violations、git diff --check、base.css 括号平衡；其 AC4 慢放录屏证据按「CI-only 政策」外置，由票 77 承担。

> **诚实标注**：这不是「检查通过」，而是**覆盖缺口**。零闪现机制是 A-025 显式约束「不回滚零闪现」的保护对象，却无自动化回归守卫；一旦 render.js 的摘除点被后续票误删，CI 不会报警。已作为呈报项 P-73-1 上报（§6）。

---

## 3. 专属验收：新开标签主题仍为记忆态 —— 实测通过

### 3.1 方法

一次性 Chromium 脚本（**写在 OS 临时目录，运行后删除；未入库、未加入 test/**，避免与并行窗口争用测试文件），模拟「标签 1 选主题 → 新开标签」的真实路径，并在新标签用 addInitScript 注入探针，于**首帧（rAF / DOMContentLoaded）**快照 html 类名与主题变量。

关键参数：--allow-file-access-from-files（playwright.config.ts 已注明：Chromium 对 file:// 下的 ES module 默认 CORS 阻断，缺此参数则 ntp.js 不执行、__boxingDebug 永不出现）。

### 3.2 证据

| 观测点 | 实测值 | 判定 |
|---|---|---|
| 记忆态镜像 | boxingBootTheme.v1 = theme=forest, darkMode=false, fontSize=14 | 勾 已随 saveLayout 成功路径落盘 |
| 新开标签**首帧** --color-accent-500 | #6A9870（forest） | 勾 **不等于默认 beige #A08060** |
| 新开标签**首帧** --color-warm-50 | #EDF1EC（forest light） | 勾 不等于 beige #F1EEE8 |
| 新开标签**首帧** body 背景 | rgb(237, 241, 236) | 勾 forest 底色，非 beige rgb(241,238,232) |
| 新开标签**首帧** html 类 | 含 boot-pending | 勾 内容遮罩在位，遮罩期不会露出默认 UI |
| 渲染完成后 | boot-pending 已摘除；layout.settings.theme = forest | 勾 unmask 正常，主题未被回滚 |
| **对照组**（清 localStorage 后重载） | --color-accent-500 = #A08060 | 勾 判别力验证：forest 结果确由镜像驱动，非常量巧合 |

**结论：专属验收「新开标签主题仍为记忆态」成立。** 且顺带证明「首帧无默认主题闪现」—— 即 AC2 的「成立则」分支虽因 H1 否证而不适用，其验收内容在实测中依然为真。

> **信息缺口（诚实标注）**：探针的 MutationObserver 未捕获到 unmask 瞬间快照（trace.unmask = null，疑为 addInitScript 阶段观察目标绑定时机问题）。该缺口以终态断言替代：渲染完成后 finalHasBootPending = false，足以证明遮罩被正常摘除、不会永久遮蔽内容。

---

## 4. D-005 调研协议

| 项 | 执行 |
|---|---|
| 1. atomcode / 等价深度调研 | 已读 atomcode-ga-residual-research.md §4（H1 假说原始表述）与 T-GA1/T-GA4 定义。原报告对 H1 的自评即含保留：「基线 34626507101 早于闪现 land 已三 OS 红；故 H1 只能解释增量，不能解释全部存量」。票 70 用第三方 CI 集合相等性独立复核后进一步否证。本票采纳，不再重复调研。 |
| 2. ADR / CONTEXT 心智模型回顾 | ADR-0012（策展主题包，2026-08-10 Accepted）、ADR-0017（G-A/G-B/G-C 合取门禁）、docs/CONTEXT.md §41 zero-flash new tab、§42 paint-critical boot mirror、§43 Wave7 settle、§44 Wave8 grill、§118 release gate。本票全部**服从**，未改写任何一条。 |
| 3. 工业对标 | 2026 年 anti-FOUC 主流范式仍是「head 内最高优先级**阻塞**脚本，在首帧前同步读 localStorage 并应用主题变量」（典型实现：render-blocking head script，fallback 到 OS 偏好）。Boxing 采用其 **CSP 合规变体**：ntp/boot-theme.js 为 external classic（非 module、非 inline）脚本，满足 script-src self，功能上等效于内联方案且更符合扩展 CSP 约束。判定：实现与工业成熟方案**一致**，无需改向。 |

---

## 5. 与 current 决策的关系

- **无冲突、无 revised、无新 D-xxx。**
- A-025 约束「不改 ADR-0017；禁 G-D；不回滚零闪现」被完整服从：本票零源码改动，boot-theme 机制经 §2.1 + §3 双重验证在位。
- A-008（修绿优先、数据完整性永不豁免）、A-037（D-005 协议）、ADR-0017（G-A∧G-B∧G-C）均未触碰。
- 本票**不 tag、不宣称可发行、不扩 ADR-0017、不改豁免台账**。§3 的运行时通过**不构成 G-A 门禁证据**（门禁以 main 全量 CI 为准）。

---

## 6. 呈报项（本票不自行落地，交大脑窗口裁决）

| ID | 内容 | 理由 |
|---|---|---|
| **P-73-1** | 票 60 未交付 boot-pending 专项 e2e 用例（§2.2）。建议**另立票**补「boot 镜像首帧」回归测试：断言新开标签首帧 accent-500 / warm-50 等于记忆主题值、首帧含 boot-pending、渲染后摘除。 | A-025 显式要求「不回滚零闪现」，但该约束当前**无自动化守卫**；本票为 N/A 票，补测试不属本票范围。 |
| **P-73-2** | 采纳票 70 §5 的 spec 措辞修正建议：spec.md:292「票 73 仅当 H1」应追加「H1 已否证 → 票 73 暂挂；若 T-GA3 证明 conn-delete 面属卸载写回时序，应**另立票**而非复用票 73（票 73 绑定零闪现）」。 | 避免后续窗口误把 B 桶时序问题塞进零闪现票。本票**不自行改** spec.md —— 该文件当前存在并行窗口未提交改动，静默编辑会卷入他人 hunk（WORKFLOW §6 票 05/83 教训）。 |

---

## 7. 交付物

| 路径 | 内容 |
|---|---|
| .scratch/architecture-recovery/reports/73-report.md | 本报告 |
| .scratch/architecture-recovery/issues/73-ga-boot-pending-e2e.md | AC 三框全勾 |

---

## 8. 版本控制

遵循 WORKFLOW §4.2：but diff 确认改动 → but commit -b 分支名 -m 消息 改动id。不 push、不开 PR、不 tag。
