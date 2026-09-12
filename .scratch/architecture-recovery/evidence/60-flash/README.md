# Ticket 60 — new-tab zero-flash slow-mo evidence (Chrome + Firefox)

> AC: Chrome+Firefox 新开标签慢放：无默认 beige、无亮暗跳变、无非记忆盒子可见帧。
> Per spec D-003: 自建证据目录，不勾进 G-B 六项（闪现不进 ADR-0017 门禁）。

## Status (ticket 77, 2026-09-12)

- 人工采集基础设施已备: capture-card-chrome.md + capture-card-firefox.md（执行卡）+ capture-notes.md（逐车道记录模板）。
- 验收对象固定为 2026.9.12 候选工件: run 34689649760（main 构建，含零闪现修复 898119eb）；勿复用 gb-2026.9.13。
- 状态: ready-for-human — 证据文件由执行人按卡采集落盘；agent 只备卡/复核（issues/77 AC 1/2 待采集完成后勾选）。

## Capture procedure (per browser)

1. 按采集卡第 0 节装载 2026.9.12 解包产物并设置记忆态基线（非默认主题 + darkMode ON + 2-3 盒子）。
2. 路径 A: DevTools Performance 帧步进（刷新 NTP，DevTools 在场）→ 逐帧断言 F1–F3。
3. 阳性对照: 清 boxingBootTheme.v1 镜像 → 刷新应捕获 beige 降级帧（证明方法灵敏度），完成后还原镜像。
4. 路径 B: 60fps 系统录屏覆盖真·新开标签（Ctrl+T，DevTools 不在场）。
5. 判定边界: 浏览器 paint 前的纯白/空白帧不算闪帧；已渲染出 beige/亮色背景才算。

## Files

- capture-card-chrome.md / capture-card-firefox.md — 逐车道执行卡（票 77 备）
- capture-notes.md — 逐车道记录模板（F1–F3 断言 + 阳性对照 + 汇总）
- chrome/ — Chrome 车道证据文件（执行人按卡落盘: 逐帧截图 + 阳性对照 + 可选录像）
- firefox/ — Firefox 车道证据文件（同构）

CI-only policy: 本机不产构建产物；采集对象为 CI 工件（run 34689649760）解包目录，人工在真浏览器执行。