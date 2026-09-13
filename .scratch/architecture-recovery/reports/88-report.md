# 88 报告 — R2 empty-state Bug5-dark 分诊与修复（covers A-042）

> 窗口：Boxing Wave9 实施子窗口 · ticket 88 · Blocked by: None（可立即开工）
> 必读清单 7 项**全部存在**：handoff 1711 B / issue 621 B / spec.md 4815 B / WORKFLOW.md 30037 B / ADR-0017 10313 B / CONTEXT.md 29800 B / decision-ledger 10595 B

## 1. 调研摘要（handoff 通用三项，先行于实现）

### 1.1 atomcode 深度调研

- **工具可用性**：本窗口 atomcode 未暴露（ToolSearch 未返回 atomcode；按 1mcp 网关回退流程核查，网关仅返回 ctx_doctor）。WORKFLOW §4.3 要求联网调研必须经 ctx 包裹且串行，故改用经 ctx 包裹的 `ctx_fetch_and_index` 拉取 **W3C 规范原文**作为工业标准锚点（串行 1 次，3 源：`wcag-1.4.3` / `wcag-1.4.11` / `wcag-1.4.11-understanding`）。
- **不静默改向**：这是「工具不可用」下的等价替代，非偏好变更，按 A-037 协议在此呈报。
- **结论（规范原文核验）**：
  - SC 1.4.3 Contrast (Minimum)：正文文本与文本图像对比度 **≥ 4.5:1**；大字号（≥18pt 或 14pt 粗）才放宽到 3:1。本按钮 13px/500 → 适用 4.5:1。
  - SC 1.4.11 Non-text Contrast：非文本视觉信息 **≥ 3:1**。
  - Understanding「Boundaries」原文：**不强制**控件带边界——若控件有「足够对比度的内容（文本或图标）」足以表明其存在，则边界不受 1.4.11 约束；仅当「无其它视觉方式识别控件存在」时边界才被要求。且原文明确：*为认知障碍用户，最佳实践是所有控件都描绘边界*。
  - → 因此本票的**规范级不合格项是 1.4.3**（字形 4.45:1 < 4.5:1）；边界 1.20:1 属**最佳实践不合格**，不是严格的 1.4.11 失败。该区分已如实标注，未夸大。

### 1.2 ADR 与 CONTEXT.md 心智模型回顾

| 现有心智模型 | 与本票的关系 | 是否冲突 |
|---|---|---|
| ADR-0008 三层 token：暗色**只覆盖 Layer 2 语义 token**，组件 CSS 不变；逐组件覆盖是反模式，例外需 `DARK-EXCEPTION` 标注 | 本票暗色修复**只换语义 token**（`--color-muted` / `--color-ink-soft`），未硬编码任何色值、未新增 token、未新增逐组件硬编码规则（复用票 13 既有规则体） | 无冲突 |
| ADR-0011 + css-dual-write-convention：`ntp/ntp.css` 是 gitignore 的**构建产物**，由 base + settings + onboarding + conn 拼接 | 仅改源文件 `ntp/settings.css`，再用 `buildNtpCss()` 重生成产物；未手工编辑产物 | 无冲突 |
| ADR-0017 Release Data Gate：三条件合取可发行、残红禁 tag、N 桶/数据完整性永不豁免 | 本票不触碰门禁、不宣称三门达成、不 push / 不 tag | 无冲突 |
| CONTEXT.md / DESIGN.md 暗色策略：token 覆盖；`--color-hairline` 被组件状态表用作按钮默认描边 | **发现错配**：`--color-hairline` 语义是「弱分隔线」（暗色 = rgba(255,255,255,0.06)），被复用为「透明 ghost 按钮的唯一边界」时实测仅 1.20:1 | **记 revised 并呈报**（见 §7） |

### 1.3 工业级实现/测试策略对标

- **对比度断言形态**：工业做法是对 **computed style 派生的比值** 断言，而非硬编码色值——token 调整时硬编码断言会失效或掩盖回归。本票新测试采用比值断言（≥4.5 / ≥3）。
- **过渡态竞态**：CSS transition 下「同轮读取 computed style」必然采样到过渡起点；Playwright 惯例是 poll 到稳定值。本仓库票 72 已在同一按钮确立 `expect.poll` 约定，本票沿用（未引入新的 sleep）。
- **构建产物不入版本库**：与 ADR-0011 一致，产物由构建再生，符合工业 generated-artifact 惯例。

## 2. 分诊：env vs 产品（AC 第 1 项）

| 证据源 | 失败签名 | 定性 |
|---|---|---|
| `.scratch/.../70-ci-logs/base-*.log`（2026-09-11，三 OS × ff+ch 全红） | `Error: page.hover: Test timeout of 30000ms exceeded` … `<div role="dialog" aria-modal="true" id="onboarding-overlay"> intercepts pointer events` | **env / 测试装置**：file:// lane 首次运行展示 onboarding 遮罩拦截真实指针。已由票 48 在 `resetBoxing` 注入 `skipOnboarding()` 修复 |
| `.scratch/.../70-ci-logs/new-*.log`（2026-09-12，三 OS × ff+ch 全红） | `expect(hoverBg).toBe(probeBg)` → Expected `rgba(196, 168, 130, 0.12)`，Received `rgba(0, 0, 0, 0)`；Retry #1 Received `rgba(196, 168, 130, 0.06)`（= 0.12 的过渡中点） | **env / 测试装置**：`background` 经 `--dur-fast`(140ms) 过渡，同轮读取采样到过渡起点/中点。已由票 72 改为 `expect.poll` 修复 |
| 当前工作树实测（本窗口） | Bug5-dark 在 chromium-extension 与 firefox-extension **均通过** | CI 侧失败已消解 |

**结论**：Bug5-dark 的 CI 残红 = **env / 测试装置问题**（两层：onboarding 遮罩拦截 + 过渡竞态），**不是**产品对比度缺陷；且两层均已在既有票（48、72）中修复，本票复核确认。

**但**：AC 要求的「暗模式空态添加按钮对比度可见」经实测**确为真实产品缺陷**（§3），故本票同时输出 env 分诊结论与产品修复——不是二选一。

## 3. 产品缺陷实测（修复前，探针取数）

探针：Chromium + `--allow-file-access-from-files` + 加载扩展，file:// 打开 ntp/index.html，建大盒 → 进入 → 建小盒 → 加 `ntp--dark`，读 computed style 并按 WCAG 公式合成比值。

| 项 | 亮色 | 暗色（修复前） | 门槛 | 判定 |
|---|---|---|---|---|
| 字形/文本 color | rgb(123,113,103) → 3.81:1 | rgb(154,146,133) → **4.45:1** | SC 1.4.3 ≥ 4.5:1 | 暗色 **不合格**（差 0.05） |
| 虚线边界 border-color | rgba(42,37,32,0.06) → 1.11:1 | rgba(255,255,255,0.06) → **1.20:1** | 最佳实践 ≥ 3:1 | 暗色 **严重不合格** |
| 背景 background | rgba(0,0,0,0) | rgba(0,0,0,0) | 票 13 契约 | 合格（保持） |
| 可点（真实点击弹出加书签弹层） | true | true | — | 合格 |

背景 backdrop：`rgb(48,45,41)` = `--color-elevated`(#302D29)。按钮为透明 ghost、**无填充**，故虚线是唯一边界线索——这正是 hairline 错配被放大的原因。

### 3.1 空态动作按钮家族复核（AC 覆盖完整性）

AC 措辞是「空态添加按钮」，是一个**家族**而非仅 `.bm-add-btn`。三处真正的空态入口在暗色下实测：

| 按钮 | 文本 vs 填充 | 边界 vs 背景 | 填充 vs 背景 | 判定 |
|---|---|---|---|---|
| `.canvas__empty-action` | **6.22:1** | 1.80:1 | 1.25:1 | 文本达标 |
| `.large-box__empty-action` | **5.75:1** | 1.78:1 | 1.25:1 | 文本达标 |
| `.inner__empty-action` | **6.22:1** | 1.80:1 | 1.25:1 | 文本达标 |

**判据一致性**：SC 1.4.11 Understanding「Boundaries」规定，控件若有「足够对比度的文本内容」表明其存在，则边界**不受**非文本对比约束。这三枚带清晰文字标签、文本 5.75–6.22:1（≥4.5:1）→ **规范层面合格**；而 `.bm-add-btn` 的 "+" 仅 4.45:1，内容本身不达标，故其边界必须补强。**两者判据一致，未双标**。

因此本票**不改**这三枚——边界/填充偏弱属观感层面，无规范依据，不越界做静默变更；但新增测试锁住其文本契约（§4.3），防止未来 token 调整把空态标签降到 4.5:1 以下。

## 4. 改动

1. **`ntp/settings.css`（唯一源文件改动）** — `.ntp--dark .bm-add-row .bm-add-btn`：
   - `border-color: var(--color-hairline)` → `var(--color-muted)`（#9A9285，4.45:1）
   - `color: var(--color-muted)` → `var(--color-ink-soft)`（#C8C2B6，7.73:1）
   - 新增注释说明测得比值与选中 token 的理由；`background: transparent` **一字未动**（票 13 契约保持）。
2. **`ntp/ntp.css`** — 由 `buildNtpCss()` 重新生成（64434 chars）。**产物、gitignore、不入版本库**，未手工编辑。
3. **`test/tests/boxing-empty-state-buttons.spec.ts`** — **新增 2 个测试，既有断言一字未改**：
   - `Bug5-dark contrast: bm-add-btn is perceivable and clickable in dark mode`（line 311）：比值断言（text ≥ 4.5、border ≥ 3）+ 真实指针点击断言。
   - `Bug5-dark contrast: empty-state action buttons keep legible labels in dark mode`（line 427）：锁定三处空态入口（canvas / large-box / inner）文本对比度 ≥ 4.5，覆盖 AC 措辞的整个「空态添加按钮」家族。
4. **未触碰**：`ntp/base.css`、任何 JS、票 87/89-94 文件、ADR、ledger 以外的文档。

## 5. AC 对照

| Acceptance criteria | 状态 | 证据 |
|---|---|---|
| 分诊 env vs 产品 | **done** | §2：CI 残红 = env（遮罩拦截 + 过渡竞态），已由票 48/72 修复并复核 |
| 产品修复 token/样式 | **done** | §4：仅换语义 token，未硬编码；实测 4.45→7.73、1.20→4.45 |
| 非只改断言掩盖缺陷 | **done** | 改的是产品 CSS（settings.css 源文件 + 产物再生）；新增断言为**新增**契约，既有 Bug5 / Bug5-dark 断言未改一字 |
| 报告 `reports/88-report.md` + CI 证据 | **done** | 本文件；本地双浏览器锚点见 §6。第三方 CI（GitHub Actions）run URL 需明令 push 后补充——**未 push，故无 CI run URL 可附** |
| 暗模式空态添加按钮对比度**可见** | **done** | `.bm-add-btn`：字形 4.45→**7.73:1**（≥4.5）、边界 1.20→**4.45:1**（≥3）；三处空态入口文本 **5.75–6.22:1** 本就达标，已由新测试锁定（§3.1） |
| 暗模式空态添加按钮**可点** | **done** | 真实指针点击后 `.bm-edit-popup` 出现（既有行为 + 新测试锁定） |
| 覆盖「空态添加按钮」**全家族**而非单枚 | **done** | §3.1 三处入口实测 + line 427 测试 |

## 6. 验证锚点

| 面 | 命令 | 结果 |
|---|---|---|
| CSS 平衡门禁 | `node scripts/css-balance-guard.mjs` | OK（6 源平衡、无嵌套 [hidden]） |
| 导入图门禁 | `node scripts/import-graph-guard.mjs` | 15 modules / 48 edges / **0 violations** |
| 迁移 golden 门禁 | `node scripts/migration-golden-guard.mjs` | **28/28 passed** |
| chromium-extension 全 spec | `npx playwright test --project=chromium-extension --grep "Empty state buttons"` | **21/21 passed（19.7s）** |
| firefox-extension 全 spec | `npx playwright test --project=firefox-extension --grep "Empty state buttons"` | **21/21 passed（31.5s）** |
| 对比度探针（修复后复测） | 临时探针脚本 | 暗色 text **7.73:1** / border **4.45:1** / bg `rgba(0,0,0,0)` / 点击→弹层 `true` |
| 空态家族探针（canvas / large-box / inner） | 临时探针脚本 | 暗色文本 **6.22 / 5.75 / 6.22 :1**；边界 ~1.8:1、填充 1.25:1（按 1.4.11 Boundaries 免于非文本约束） |
| 爆炸半径复核（引用 `ntp--dark` 的全部 spec） | `grep -rln ntp--dark test/tests/` → empty-state + boot-pending | empty-state **21/21**、boot-pending（票 92）**4/4** 均绿 |
| 产物可重现性 | `buildNtpCss()` 再生成后 md5 比对 | 重建前后 md5 均为 `53bb3f86412ca22b76c4f46dcf948580`，修复确定由源文件再生、非手工编辑 |
| 稳定性压测（AC「CI 稳定通过」） | `--repeat-each=5` 跑 3 个 Bug5-dark 测试 | **15/15 passed（34.9s）**，零抖动 |
| 完整构建（CI 同路径，含 A8/A10 CSS 门禁） | `npm run build` | `A8: CSS dual-write markers OK` · `A10: CSS brace-balance + nested-[hidden] gate OK` · `DONE_BUILD` |
| 打包产物携带修复 | `dist/boxing-chrome` 与 `dist/boxing-firefox` 的 `ntp/ntp.css`；以及 `boxing-2026.9.12.zip` 内解包核验 | 三处均含 ticket 88 修复（zip 内 `has fix: True`）——修复进入真实打包面，而非仅 file:// 测试通道 |

## 7. 残留风险与呈报

1. **亮色模式同按钮同样不达标**（text 3.81:1、border 1.11:1）。本票按 AC 范围（暗模式）**未改**，避免越界静默变更 → 建议另立票复核亮色按钮对比度。
2. **revised 呈报**：DESIGN.md 组件状态表把 `--color-hairline` 定为按钮默认描边；本票实测证明该 token 在暗色（rgba(255,255,255,0.06)）**不足以承担「控件边界」职责**。未擅自改 DESIGN.md，呈报待决。
3. **macOS 未本地覆盖**：本机为 Windows，本地锚点是 chromium + firefox 双浏览器全绿；CI 三 OS 的 macOS 面需第三方 CI 复核。
4. **产物依赖**：`ntp/ntp.css` 为 gitignore 产物；任何未重新构建的环境看不到本修复。
5. **边界值裕度**：边界 4.45:1 相对 3:1 门槛有裕度，但若未来 `--color-muted` 被调暗，新测试会立即失败（这正是断言的设计意图）。

## 8. 版本控制

遵循 WORKFLOW §4.2（唯一来源）：`but diff` 确认改动 → `but commit -b <branch> -m "<消息>" <改动id...>`；不 push、不开 PR、不改写其它窗口提交。

## 9. 待大脑裁决项（本窗口不擅自决定）

| # | 事项 | 证据 | 本窗口建议 | 状态 |
|---|---|---|---|---|
| Q1 | 亮色模式 `.bm-add-btn` 同样不达标（字形 3.81:1 < 4.5、边界 1.11:1 < 3） | §3 实测表「亮色」列 | 另立票处理；不在 A-042（暗模式）范围内越界修改 | **待裁决** |
| Q2 | DESIGN.md 组件状态表把 `--color-hairline` 定为按钮默认描边，与其「弱分隔线」语义冲突 | §1.2；暗色下该 token = rgba(255,255,255,0.06)，实测 1.20:1 | 记 **revised**：建议统一按钮描边 token；未擅自改 DESIGN.md | **待裁决** |
| Q3 | 第三方 CI（GitHub Actions）run URL 缺位；macOS 面本机不可覆盖 | §6 锚点均为本地 ff+ch（Windows 宿主） | 需明令 push 后补 run URL；在此之前不得宣称 CI 绿 | **待裁决（需明令 push）** |
| Q4 | **全量 suite 当前无法运行**：`test/tests/boxing-merge-three-way.spec.ts:21` 只导入了 `pathToFileURL`，但第 23 行使用 `fileURLToPath`，Playwright 在加载阶段即失败，`--list` 返回 0 tests | `--list` 报错 + `Total: 0 tests in 0 files`；全仓扫描确认**仅此一个文件**有此缺陷 | 单行修复：`import { pathToFileURL, fileURLToPath } from 'url';`。属票 91 窗口文件，本窗口**未修改**；不修则任何窗口都拿不到全量回归证据 | **待裁决（跨窗口 blocker）** |
| Q5 | **明文凭据已入库（安全，优先级最高）**：`test/tests/boxing-merge-three-way.spec.ts` 顶部常量含真实 WebDAV 账号、明文密码（已脱敏，值见该文件第 28 行）与真实 Koofr 服务地址，且已随提交 `874cde9e`（票 91）进入 **git 对象库** | `git grep WEBDAV_PASS` 在 `874cde9e` 命中该文件；`git log --all` 可见该提交 | ① **立即轮换该凭据**（已暴露，删文件不能清除历史）；② 改由环境变量/CI secret 注入；③ 历史清理需另行评估（涉及改写他人提交，**未擅自执行**）。与票 82 的 BX-CRED 运行时加密不冲突——问题出在凭据被写进源码 | **待裁决（建议立即处理）** |
