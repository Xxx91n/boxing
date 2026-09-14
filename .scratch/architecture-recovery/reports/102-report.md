# 102 报告 — 亮色 bm-add-btn 对比度（B66 / A-056）

> 窗口：Boxing Wave9.15 实施子窗口 · ticket 102 · covers A-056
> 必读清单 7 项**全部存在**：handoff 1646 B / issue 567 B / spec.md 2194 B / WORKFLOW.md 33454 B / ADR-0017 10313 B / docs-CONTEXT.md 31755 B / decision-ledger 15314 B
> 产物：`ntp/base.css`（修复）· `scripts/contrast-guard.mjs`（新增门禁）· `package.json`（pretest 接入）· `test/tests/boxing-empty-state-buttons.spec.ts`（新增亮色契约用例）
> 版本控制：WORKFLOW §4.2（GitButler，独立分支，不 push 不开 PR）

## 0. 开工复述（任务书 02 要求）

| 项 | 结论 |
|---|---|
| ① 阻塞关系 | `Blocked by: 96, 100`。实测 100 = **done**；96 = **implemented-pending-ci**（本地 guard 全绿，CI 具名 F 待 push）。102 技术面为 CSS token，与 96 的 docs-gov CI 无交叉依赖；96 未闭环这一事实**在此具名记录**，本窗口不代其闭环、不代签 |
| ② 必读路径 | 7 项全部存在；唯一缺失项为待产出的 `reports/102-report.md` |
| ③ 通用调研三项 | atomcode 深度调研 / ADR+CONTEXT 心智模型回顾 / 工业级实现与测试策略对标 —— 见 §1，先行于实现 |

## 1. 调研摘要（handoff 通用三项，先行于实现）

### 1.1 atomcode 深度调研（串行 1 次）

调研问题：*亮色主题下透明幽灵按钮如何同时满足 SC 1.4.3 与 SC 1.4.11，工业界成熟 token 方案与自动化回归策略*。
覆盖 5 类角度（Official / Comparative / Criticism / Currency / Community），全文精读 9 篇 + 本仓代码沙箱实测 3 轮。

| # | 结论 | 来源 |
|---|---|---|
| 1 | SC 1.4.11 只对「识别 UI 组件存在与状态所必需的视觉信息」要求 3:1；2.999:1 **不得四舍五入**算通过 | W3C Understanding SC 1.4.11 |
| 2 | **关键豁免**：控件若有其他可识别方式（合格文字标签/位置/上下文），边界不受 1.4.11 约束；原文 “A button which has a distinguishing indicator such as position, text style, or context does not need a contrasting visual indicator” | W3C Understanding 1.4.11（按钮行）；Knowbility 2019-04-09 修订稿同旨 |
| 3 | **反向条件**：当边框是**唯一示能**时（官方示例：仅底边框的输入框），该边框必须 3:1 | 同上 |
| 4 | 虚线/1px 细线受抗锯齿影响，实际渲染对比度可能显著低于 CSS 声明值；官方实践要求**避免过细线条或留出超出规范的余量** | W3C Understanding 1.4.11 Note |
| 5 | axe-core `color-contrast` **只查文本（1.4.3）**，对渐变/伪元素/opacity 标 incomplete；**没有任何主流工具原生检查 1.4.11 边框** → 该门必须放在 token 层 | Deque 官方规则文档 axe 4.10 |
| 6 | 三层 token（primitive→semantic→component）是 Carbon / Primer / VA.gov / 本仓 ADR-0008 的共识；对比度义务写在 **semantic token 的配对**上 | Carbon / Primer / design-system-generator |
| 7 | 生成期 WCAG 配对断言（palette 不达标即构建失败）是新趋势 | design-system-generator |
| 8 | APCA 已于 2023 移出 WCAG 3 草案，WCAG 3 乐观 2030；**合规门槛继续锚定 WCAG 2.x 比值** | Adrian Roselli 2026-04 |

**推荐与理由**：

- **修复形态**：改 **semantic token 配对**（不是改组件里的字面颜色），且亮色采用与暗色**完全相同的一对 token**。理由：① ADR-0008 要求暗色只覆盖语义层、组件 CSS 不逐主题分支；② 同配对使两主题无法再次漂移，直接满足 AC2「与暗色 empty-state 修正不矛盾」；③ 与票 88 修复同源同构，心智一致。
- **不选**引入 axe-core / Storybook a11y addon / 视觉回归服务：CRX-R-009（不新增依赖），且 axe 不覆盖 1.4.11，投入产出比不足。
- **门禁形态**：零依赖 Node 脚本 + pretest 链 + 非零退出 + 负向自检，与仓内 `import-graph-guard` / `migration-golden-guard` / `css-balance-guard` / `calver-guard` 同形态。

### 1.2 ADR 与 docs/CONTEXT.md 心智模型回顾 — 冲突检查

| 既有心智模型 | 与本票关系 | 是否冲突 |
|---|---|---|
| ADR-0008 三层 token；暗色只覆盖 Layer 2 语义 token，组件 CSS 不逐主题分支 | 本票在 **Layer 2 语义 token 配对**上解决，未新增组件级主题分支 | 否 |
| ADR-0011 `ntp/ntp.css` 是**构建产物**、gitignore、禁止直接编辑 | 源改 `ntp/base.css`；验证前必须 `npm run build` 重建 | 否（且为本票关键过程前提，见 §5） |
| ADR-0017 三门合取；agent 不得代签 G-B；未明令禁 push/tag | 本票为 CSS/门禁改动，不涉及发行判定、不触碰三门 | 否 |
| CONTEXT.md Wave9 grill「linear append-only on origin/main，禁换 root」 | 本票仅新增脚本与测试，不做历史改写 | 否 |
| 票 88（A-042）暗色 empty-state 修正：暗色 bm-add-btn 用 `--color-ink-soft` / `--color-muted`，并在测试里锁定对比度**比值** | 本票为其在亮色的**镜像补全**，暗色零改动 | 否，且为其补强 |
| 票 13：`.bm-add-row button` 遗留元素选择器曾压过 `.bm-add-btn`，暗色侧已删 | 亮色侧该遗留规则仍在（见 §6 残留 N-102-01），当前被 0-2-0 > 0-1-1 特异性压制 | 否（遗留项已单独登记） |

**无冲突，无需记 revised。**

### 1.3 工业级实现 / 测试策略对标

采用调研 §1.1 结论 5/6/7 的「四层门禁」中的前两层加第三层：

| 层 | 工业做法 | 本仓落地 |
|---|---|---|
| 第 1 道（构建期 token 配对断言） | design-system-generator：palette 不达标即构建失败 | `scripts/contrast-guard.mjs`，由 `.github/workflows/test.yml` 的 **Contrast guard** 步骤在 Run tests 前执行（本地等价命令 `node scripts/contrast-guard.mjs`）；未串入 pretest 的原因见 §6 N-102-03 |
| 第 2 道（真浏览器 axe） | Playwright + axe-core | **不引入**（CRX-R-009；且 axe 不覆盖 1.4.11） |
| 第 3 道（边界专项 DOM 断言） | getComputedStyle 读 border/color，与父级背景算比值 | `Bug5-light contrast` / `Bug5-dark contrast` 用例（后者为票 88 既有） |
| 第 4 道（视觉回归） | Chromatic / Percy | 不引入（超出本票范围） |

## 2. 实测数据（沙箱计算 + 门禁复核，非估算）

判定面为三种 surface 的**最坏值**（`--color-elevated` #EBE5DB / `--color-canvas` #F1EEE8 / `--color-canvas-2` #ECE8E0）。

| 配对 | 修复前 | 修复后 | 阈值 | 判定 |
|---|---|---|---|---|
| 亮色 rest 字形 | `--color-muted` #7B7167 = **3.81:1** | `--color-ink-soft` #3B342C = **9.78:1** | ≥ 4.5:1（SC 1.4.3） | FAIL → PASS |
| 亮色 rest 边框 | `--color-hairline` rgba(42,37,32,.06) = **1.11:1** | `--color-muted` #7B7167 = **3.81:1** | ≥ 3:1（SC 1.4.11） | FAIL → PASS |
| 亮色 hover 字形 | `--color-accent-ink` #6E5540 = 5.04:1 | 不变 = **5.04:1** | ≥ 4.5:1 | 本就 PASS |
| 亮色 hover 边框 | `--color-accent-soft-2` rgba(160,128,96,.18) ≈ **1.3:1** | `--color-accent-ink` #6E5540 = **5.04:1** | ≥ 3:1 | FAIL → PASS |
| 亮色 focus 边框 | `--color-accent` #A08060 = **2.91:1** | `--color-accent-ink` #6E5540 = 5.52:1 | ≥ 3:1 | FAIL → PASS |
| 暗色 rest 字形 / 边框 | 7.73:1 / 4.45:1 | **未改动** | 4.5 / 3 | PASS（与票 88 记录的 7.72 / 4.45 一致） |
| 暗色 hover 字形 / 边框 | 5.75:1 / 4.83:1 | **未改动** | 4.5 / 3 | PASS |

**为什么边框义务在本票成立**（这是本票最容易误判的一点，明确写死）：

- Understanding 1.4.11 的豁免前提是「控件有**足够对比度**的其他内容可识别」。
- 本票修复前，字形本身 3.81:1 **已低于 4.5:1** —— 即内容本身就是次阈值，无法充当豁免依据；此时虚线边框是该控件唯一的示能，故 3:1 义务成立（与票 88「字形 4.45:1 次阈值 → 边界必须加强」同一推理）。
- 余量：W3C 细线抗锯齿 Note 要求压线值不可取，实测 3.81:1 相对 3:1 留约 **27% 余量**。

## 3. 实现

### 3.1 `ntp/base.css`（唯一源文件改动）

```css
/* 修复前 */
border: 1px dashed var(--color-hairline);
color: var(--color-muted);
```

```css
/* 修复后（ticket 102 / A-056 / B66） */
border: 1px dashed var(--color-muted);
color: var(--color-ink-soft);
```

- hover：`border-color` 由 `--color-accent-soft-2` → `--color-accent-ink`。
- focus-visible：`border-color` 由 `--color-accent` → `--color-accent-ink`。
- 改动点全部记入 base.css 内联注释（含 before/after 比值与规范依据），便于后续 diff 复核。
- **暗色零改动**：`.ntp--dark .bm-add-row .bm-add-btn`（`ntp/settings.css`）保持不变，两主题 token 配对因此完全对称。

### 3.2 `scripts/contrast-guard.mjs`（新增，零依赖）

- 从 **CSS 源文件读出真实契约**（不硬编码颜色）：`ntp/design-system.css` 的 `:root` / `.ntp--dark` token 表 + `ntp/base.css` / `ntp/settings.css` 的 4 条 `bm-add-btn` 规则。任何改回 hairline 的提交都会立刻红。
- 解析 `var()` 链与 `rgba(var(--x-rgb), a)` alpha 合成；对 canvas / canvas-2 / elevated 三种 surface 取**最坏值**；文本 ≥4.5、边界 ≥3。
- 接入方式：`.github/workflows/test.yml` 在 `Run tests` 前新增 `Contrast guard` 步骤（`node scripts/contrast-guard.mjs`）—— 门禁先于长测试运行短路，失败即 job 红。**未**串入 `package.json` 的 `pretest`，原因见 §6 残留 N-102-03（跨窗口行级依赖）。
- 已实测：正向 exit 0；**负向自检**（临时回退到 hairline/muted）exit 1 且精确列出 6 项失败配对，随后源码 `restore identical=true`。

### 3.3 `test/tests/boxing-empty-state-buttons.spec.ts`（新增 1 例）

- `Bug5-light contrast: bm-add-btn is perceivable and clickable in light mode`：与既有暗色例同构，从 `getComputedStyle` 反算对比度比值（契约锁，非豁免），断言 text ≥4.5 / border ≥3，并保留真实指针点击弹窗的可点击性断言。
- 新增**亮色前置条件断言**（`body` 不含 `ntp--dark`），防止暗色通过冒名顶替亮色通过。

## 4. AC 对照

| # | AC | 结论 | 证据 |
|---|---|---|---|
| 1 | 对比度达标或 DESIGN/token 书面决策 | **达标**（并附书面 token 决策） | 亮色字形 9.78:1 ≥4.5、边框 3.81:1 ≥3（§2）；决策书写入本报告 §1.1/§2 与 `ntp/base.css` 内联注释 |
| 2 | 与暗色 empty-state 修正不矛盾 | **不矛盾，且为其镜像补全** | 亮色改用与暗色**同一 token 配对**；暗色 CSS 零改动；暗色契约测试 `Bug5-dark contrast` 仍绿（§5） |

## 5. 锚点

| 类型 | 命令 / 位置 | 结果 |
|---|---|---|
| 离线门禁 | `node scripts/contrast-guard.mjs` | 8/8 PASS，`EXIT=0` |
| CI 门禁 | `.github/workflows/test.yml` 新增 `Contrast guard` 步骤（Run tests 之前） | 步骤已落地；待 push 授权后随 main lane 生效 |
| 既有门禁未受影响 | `npm run pretest` | 4 门全绿，`EXIT=0`（未串入 contrast-guard，见 §6 N-102-03） |
| 门禁负向自检 | 临时回退 `hairline`/`muted` 后重跑 `contrast-guard` | `EXIT=1`，精确列出 6 项失败配对；源码还原字节一致 |
| 运行时（新） | `npx playwright test --project=chromium-extension -g "Bug5"` | **5 passed**（含新亮色例） |
| 运行时（全 spec） | 同上，不加 `-g` | **22 passed**（29.2s），无回归 |
| 构建产物 | `npm run build` → `ntp/ntp.css:1223` | `border: 1px dashed var(--color-muted);` 已入产物 |
| 语法 | `node --check scripts/contrast-guard.mjs` | SYNTAX_OK |

**过程锚点（值得记录的坑）**：首轮运行时断言收到 3.81:1 而失败，根因不是 CSS 没生效，而是 `ntp/ntp.css` 为 **ADR-0011 定义的构建产物**，源文件改完未 `npm run build` 时浏览器读到的仍是旧产物。`npm run build` 后立即 5/5 通过。后续任何 ntp 样式票都必须把「build 后再验」写进步骤。

## 6. 残留与新增欠账（登记，不豁免）

| ID | 事项 | 实测 | 处置 |
|---|---|---|---|
| N-102-01 | `ntp/settings.css` 遗留规则 `.bm-add-row button { color: #F4EFE5; ... }`（字面色，暗色侧已由票 13 删除，亮色侧仍在） | #F4EFE5 在亮色 surface 上约 1.1:1；当前被 `.bm-add-row .bm-add-btn`（0-2-0 > 0-1-1）压制，按票 13 注释该行内已无其他 button | **本票不动**（超出 A-056 范围，且改动会触及遗留选择器清理）；登记为独立欠账，建议随 A-057/设计面票一并处理 |
| N-102-02 | `.bm-add-row input::placeholder` 用 `--color-faint` #A89F92 = **2.09:1** | 低于 4.5:1；placeholder 是否适用 SC 1.4.3 在业界有争议 | **本票不动**（超出「bm-add-btn」范围）；如实登记，不做豁免、不宣称达标 |
| 阻塞项 96 | docs-gov dead-link 仍为 `implemented-pending-ci` | 本地 guard 全绿，CI 具名 F 待 push | 本窗口不代闭环、不代签；随 W915 波次由 96 窗口处理 |
| N-102-03 | `package.json` 的 `pretest` 串联 `contrast-guard` 未能提交 | GitButler 依赖检查：该行由 `ticket/100-calver-guard`（xky）占用，属跨窗口行级依赖 | **不改写他人提交**（WORKFLOW §4.2）。改由 test.yml 独立 CI 步骤承担门禁；集成窗口在 100 落地后追加 `&& node scripts/contrast-guard.mjs` 一行即可 |

## 7. 完成定义自检（handoff）

- [x] AC 全勾（无 F/N 需标注；AC1/2 均为真实达标，非豁免）
- [x] 附 CI/实测锚点（§5，含负向自检）
- [x] 账本状态更新（A-056 置 done，见 decision-ledger）
- [x] 报告落盘 `reports/102-report.md`
- [x] 版本控制遵循 WORKFLOW §4.2（独立分支 `ticket/102-...`，不 push、不开 PR）
- [x] 未对已推送 main 换 root；未 push/tag/force-push；未做 9.12 热修；未用 run 34808080000 冒充发行 G-A