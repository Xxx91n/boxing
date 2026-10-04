# ADR-0019: Global Font-Size CSS Ladder (--fs-* tokens)

## Date
2026-10-11

## Status
Accepted — Wave 2026.10.11 / D-004 (S-04)

## Context
- 现状事实：在 Wave 2026.10.11 之前，`--font-size-base` 仅在 `ntp/base.css` 的 `body` 元素上生效（`font-size: var(--font-size-base)`）。
- 遗留问题：由于底层几乎所有组件（盒子标题、芯片、操作按钮、书签弹窗、设置面板等）都在 CSS 或 JS 中硬编码了固定像素字号（约 57 处源 CSS `font-size: XXpx`，21 处 JS 内联 `style.cssText = "...font-size:XXpx..."`），导致用户在设置面板拖动 "Font Size" 滑块（范围 11–20px）时，仅极少数未覆盖字号的 body 游离文本发生改变，全局界面主要文字完全不缩放。
- 正交性红线：用户界面存在两个不同的缩放旋钮——画布 `zoomLevel`（视口世界坐标变换）与全局 `fontSize`（阅读可读性字号偏好）。二者物理语义与控制面完全正交，代码与存储键永不互写。

## Decision
1. **建立 `--fs-*` 派生阶梯**：
   在 `ntp/design-system.css` 基础 token 层建立以 `--font-size-base` 为唯一基准的 `calc()` 派生阶梯：
   ```css
   --fs-base: var(--font-size-base);
   --fs-sm:   calc(var(--font-size-base) * 0.857);
   --fs-xs:   max(11px, calc(var(--font-size-base) * 0.786));
   --fs-xxs:  max(11px, calc(var(--font-size-base) * 0.714));
   --fs-md:   calc(var(--font-size-base) * 0.929);
   --fs-lg:   calc(var(--font-size-base) * 1.143);
   --fs-xl:   calc(var(--font-size-base) * 1.214);
   --fs-2xl:  calc(var(--font-size-base) * 1.286);
   --fs-3xl:  calc(var(--font-size-base) * 1.429);
   --fs-display: calc(var(--font-size-base) * 2.571);
   --fs-hero:    calc(var(--font-size-base) * 3.429);
   ```
2. **小字下限保护（`max(11px, ...)`）**：
   ≤11px 的装饰小字（角标、grip 拖拽柄、辅助提示、计数等）采用 `max(11px, calc(...))`，确保在滑块处于 11–13px 较小档位时不会缩至 sub-11px 导致人眼不可读（参考 iOS Caption2 设计规范），而在大字号档位随基准正常放大。
3. **锚定纪律（禁止 rem / em 锚定）**：
   - 不用 `rem`：因为 `:root` 属于浏览器默认的 16px 基准，并非 Boxing 设置滑块可控的基准。
   - 不用 `em` 级联 font-size：避免组件嵌套时产生复合放大/缩小效应；`em` 仅允许用于 padding、margin、line-height 等「随本元素字号联动」的属性。
4. **全面迁移硬编码字号**：
   - CSS 源文件（`base.css`、`settings.css`、`onboarding.css`、`conn.css`）所有硬编码像素字号映射至 `--fs-*` 阶梯。
   - JS 动态生成节点（`popups.js`、`render.js`、`settings-ui.js`）所有内联 `font-size: XXpx` 迁移为 `font-size:var(--fs-*)`。
   - 保留 `font-size: 0`（三角符号隐藏黑魔法）不做改动。
5. **UI 几何与滑块不变性**：
   不做 UI 几何缩放（box/padding/icon 尺寸不随字号改变）；保持设置项滑块 11–20 范围与 `fontSize` 存储键不变。
6. **防回归门禁**：
   新增 `scripts/guard-fontsize.mjs` 自动化门禁，纳入 `package.json` 的 `pretest` 检查链，阻断任何在 `ntp/*.js` 中新增硬编码 `font-size:\s*\d+px` 的提交。

### 被否决的备选方案
- **备选 A：全局使用 rem 替换 px** —— 否决：rem 锚定在根元素 `:root` 的 font-size，与浏览器的辅助功能默认字号混杂，改写 html font-size 会破坏跨浏览器扩展隔离性与宿主重置行为。
- **备选 B：字号联动画布 zoomLevel** —— 否决：违反正交性红线。zoom 属于空间画布视口缩放，fontSize 属于文本排版可读性偏好，混淆两者的操作与状态会导致极端缩放下文本排版失真与重绘抖动。
- **备选 C：允许装饰文字缩至 8–9px** —— 否决：在常规屏幕与高分屏下，低于 11px 的文本辨识度极低，严重损害可用性。

## Consequences
- **正面**：
  - Font Size 滑块改动能够平滑、全局、等比驱动画布与设置 UI 所有文本的字号缩放。
  - 装饰性文字受 11px 兜底保护，任何档位下均保持可读。
  - 门禁脚本杜绝未来在 JS 中重新引入硬编码字号的退化。
- **负面/妥协**：
  - 在小字号档位（11px/12px），`--fs-xs` 与 `--fs-xxs` 会被 `max(11px, ...)` 钳制在 11px，不再进一步等比缩小；为了可读性这是完全可接受的折中。
- **中性/约束**：
  - 后续所有新增 UI 文本样式必须优先复用 `--fs-*` 阶梯，严禁书写字号字面量。
  - Font Size 与 zoomLevel 保持物理隔离，任何新增逻辑不得跨写对方的 storage 键。

## Review
- 复核日期: 2026-11-11
- 复核项:
  1. 检查各语言环境下（中/英/日/德等）滑块推至 20px 时是否有严重排版溢出或换行错乱；
  2. 验证 `scripts/guard-fontsize.mjs` 门禁是否有效阻断回归；
  3. 确认 Font Size 与 zoomLevel 状态及行为未发生任何耦合。
- 复核结论: 待 2026-11-11 复核回填。
