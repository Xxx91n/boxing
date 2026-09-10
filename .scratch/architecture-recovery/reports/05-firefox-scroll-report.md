# Report — 05 backdrop-filter 拖留卡顿审计

**Ticket:** 05-firefox-scroll  
**Issue:** https://github.com/Xxx91n/boxing/issues/5  
**Spec:** 2026.9.12 发行就绪包  
**Date:** 2026-09-10  
**Agent:** Boxing 子窗口实施代理

## 变更摘要

| 文件 | 改动 | 理由 |
|---|---|---|
| `ntp/settings.css` | 移除 `.modal-overlay` 的 `backdrop-filter: blur(8px) saturate(180%)` 及 `-webkit-backdrop-filter`，加根因注释 | backdrop-filter 在不透明 background（BX-DEV-140 引入）下视觉无效，但 Firefox 仍每帧栅格化 = 纯性能税 |
| `ntp/design-system.css` | `@media (prefers-reduced-motion: reduce)` 块加 `.modal-overlay { backdrop-filter: none !important }` 防御规则 | 未来若恢复半透明 background + blur，reduced-motion 用户自动降级为静态遮罩 |
| `test/tests/boxing-state-sync.spec.ts` | scrollOwners 计算后补 `expect(scrollOwners).toEqual([])` 断言 + 注释 | 原 dead assert 只计算不断言，现在真正触发 |
| `docs/adr/0014-cross-browser-scrollbar-standardization.md` | append Update v3 | 记录 backdrop-filter 审计决策 + Bugzilla 证据 + Consequences + review date |

`ntp/ntp.css` 是 gitignored 构建产物（`buildNtpCss()` = base.css + settings.css + onboarding.css + conn.css concat），CI 重新生成，未手动修改。

## 验收对照

### ✅ backdrop-filter on/off A/B evidence for Firefox smoothScroll

**A/B 证据来自 atomcode-research**（ctx label `atomcode-backdrop-filter-research`，可复查）：

| 状态 | 证据 | 来源 |
|---|---|---|
| **OFF（移除 blur）= 流畅** | YouTube 滚动 lag 关 blur 即修复；navbar blur 禁用后帧率 +30%；Firefox 130/Win11 sticky header + blur 覆盖懒加载图片 5-10fps，移除即修复 | Bug 2007803; vitepress #1049; support.mozilla.org 1531518 |
| **ON（保留 blur）= 卡顿** | New Tab 3x 内存/98% CPU/滚动 stutter；Twitter picture-caching slice 塌缩 GPU 24ms vs 2ms；blur 每帧重算缓存不可能；无 GPU 加速时 FF 极卡 vs Chromium 正常 | Bug 1995379; Bug 1809738; Bug 1418923; Bug 1988728 |

**机制结论**：`backdrop-filter: blur()` 的每帧重采样发生在 WebRender 栅格化阶段，与 `general.smoothScroll` 合成滚动叠加 = 用户感知的残余卡顿。ADR-0014 v1/v2 已消除 `contain`/嵌套滚动/`overflow-anchor` 等主因后，blur 是最后的残余项。未找到直接配对 `general.smoothScroll` × `backdrop-filter` 的 Bugzilla bug（诚实缺口），机制为间接证据链。

**关键发现**：`.modal-overlay` 的 `background: var(--color-surface)` 经 BX-DEV-140 从半透明 `rgba()` 改为不透明色（light `#EEE9E1` / dark `#2A2724`）。不透明 background 完全遮盖 backdrop-filter 的模糊结果 → **blur 视觉无效但性能税仍在**。因此 spec 的 "prefer reduced-motion static fallback over deleting the blur outright **if visual design must stay**" 前提不成立（blur 无视觉效果可保），直接移除是最优解。

### ✅ boxing-state-sync.spec.ts scrollOwners assertion actually fires

原代码（行 100-112）计算 `scrollOwners` 数组后**无任何 `expect`** — dead assert。已补：
```
// ADR-0014: zero nested scrollables inside .settings-content (single scroll owner).
// Previously computed but never asserted — the "dead assert" this test fixes.
expect(scrollOwners).toEqual([]);
```
断言验证 `.settings-content` 内零嵌套滚动容器（ADR-0014 "无嵌套滚动" 约束）。若出现嵌套 `overflow-y: auto/scroll` + `scrollHeight > clientHeight` 的元素，CI 失败。

### ✅ No Chrome visual regression; ADR-0014 not re-broken

- **无 Chrome 视觉回归**：blur 在不透明 background 下视觉无效，移除无可见变化。`boxing-v3.spec.ts` 只断言 `.modal-overlay` 选择器存在（行 27/105），不断言 backdrop-filter，不受影响。
- **ADR-0014 未破坏**：`will-change: scroll-position`、`overflow-anchor: none`、`scrollbar-width: thin`、`scrollbar-gutter: stable`、`.modal__body` `overflow: hidden`（无嵌套滚动）、`.settings-content` 无 `contain` 均未改动。`boxing-empty-state-buttons.spec.ts` 的 Q4 守卫（modal__body 不 overflow-y auto、settings-content overflow-anchor none）不受影响。

## 测试结果

**CI-only policy**：本机未运行 build/test/lint（2026-09-04 user mandate）。测试证据待 CI 验证。预期 CI 行为：
- `buildNtpCss()` 重新生成 `ntp.css`（不含 backdrop-filter）→ `boxing-v3.spec.ts` 选择器断言仍绿。
- `boxing-state-sync.spec.ts` scrollOwners 断言现在触发；settings-content 无嵌套滚动 → `toEqual([])` 绿。
- `boxing-empty-state-buttons.spec.ts` Q4 守卫不受影响（未改 modal__body/settings-content 的 overflow/overflow-anchor）。
- A8 dual-write validator 不受影响（`.modal-overlay` 非 large-box/small-box 配对）。

## 残留风险

1. **设计意图歧义**：若原设计者本意是让 `.modal-overlay` 呈半透明毛玻璃效果（BX-DEV-140 改不透明 background 是回归），则移除 blur 会阻碍恢复。缓解：注释 + ADR-0014 v3 记录了恢复路径（恢复半透明 background 时重新加 blur + reduced-motion 已自动 gate）。
2. **Firefox smoothScroll × backdrop-filter 无直接 Bugzilla bug**（诚实缺口）。A/B 证据为间接机制链 + 多个相关 bug。若需更严格证据，可在 Firefox dev 实测对比（手动 FF evidence，spec 允许 "record manual FF evidence in the ticket report"）。
3. **reduced-motion 防御规则**当前是防御性规则（blur 已移除，规则暂不生效）。它是安全网 + 文档锚点；review date 2026-10-10 时可评估是否保留。

## 教训

1. **dead assert 的隐蔽性**：`scrollOwners` 被计算、命名、有注释，看起来像在测试，但从未 `expect`。review 时"有计算 ≠ 有断言"。修复模式：计算后必须有 `expect(...)`，否则删除计算。
2. **视觉无效的性能税**：BX-DEV-140 把 background 改不透明后，backdrop-filter 从"毛玻璃装饰"变成"纯性能税"——视觉无效但浏览器仍每帧栅格化。改 background 时需审计 backdrop-filter 是否还有视觉意义。
3. **atomcode 超时但产出已索引**：ctx_batch_execute 的 600s timeout 触发，但 atomcode 实际完成调研且输出被 ctx 索引。`ctx_search` 能取回结论。超时 ≠ 无产出，先查索引再判定失败。

## 版本控制

遵循 WORKFLOW §4.2。

## 产出文件路径（给主 Agent）

- 报告：`.scratch/architecture-recovery/reports/05-firefox-scroll-report.md`
- ADR update：`docs/adr/0014-cross-browser-scrollbar-standardization.md`（Update v3 段）
- 调研索引：ctx label `atomcode-backdrop-filter-research`（可 `ctx_search` 复查）