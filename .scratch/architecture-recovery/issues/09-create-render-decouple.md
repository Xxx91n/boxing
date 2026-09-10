# 09 — fix(create): 双击新建大盒子先渲染后落盘

**What to build:** 用户双击空白画布（或工具栏/空态 CTA）新建大/小盒子时，**同 tick 出现**新盒子；连续操作不再出现「无反馈 → 之后冒出一堆」。数据与 UI 始终一致。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 创建入口 mutate 后立即 render，**无** `await saveLayout()` 挡在 render 前
- [ ] `saveLayoutDebounced()` 或 fire-and-forget `saveLayout` 落盘；写链本体未改
- [ ] 连续双击不同位置：可见反馈与 layout.boxes 一致
- [ ] cooldown / markCreate / focus sink 行为不回归
- [ ] Playwright 扩展上下文：双击空白 → `.large-box` +1；再双击 +1
- [ ] `node --check ntp/render.js` 绿；不回归 focus-steal 与工具栏连点

## Notes

- 根因证据见 `43-2026-09-12-wave4-investigation.md` P1
- 日志文件缺失，不以日志为验收前提
