# 票 09 — 双击新建先渲染后落盘

你是 Boxing 实施窗口。只做本票。版本控制遵循 WORKFLOW §4.2（GitButler `but`）。

## 入口
- 票: `.scratch/architecture-recovery/issues/09-create-render-decouple.md`
- 代码: `ntp/render.js` `addLargeBoxAt` / `addLargeBox` / `addSmallBoxAt`
- 禁读: 不改 `ntp/storage.js` 写链

## 做
1. 读票全文与 `docs/adr/0007`、AGENTS.md SEC-08。
2. 改为: mutate → `renderCanvas()` → `saveLayoutDebounced()`（或 fire-and-forget `saveLayout`，禁止 await 挡在 render 前）。
3. 保留 cooldown / markCreate / focus sink。
4. Playwright 新 spec 或挂 existing；本地 CI-only 政策下若禁跑测试则 `node --check` + 报告待 CI。
5. `but diff` → `but commit -b 09-create-render-decouple -m "fix(create): render before save to unblock dblclick UI"`
6. 写 `reports/09-create-render-decouple-report.md`。

## 完成定义
票 Acceptance 全勾；报告含声明→证据→结论。
