# 票 12 — favicon single-flight + SWR

你是 Boxing 实施窗口。只做本票。版本控制遵循 WORKFLOW §4.2（`but`）。

## 入口
- 票: `.scratch/architecture-recovery/issues/12-favicon-cache-hardening.md`
- 调研索引: ctx_search source=atomcode-favicon
- 代码: `ntp/favicon.js` 仅此文件

## 做
1. 读票 + atomcode 推荐架构节。
2. `inflight` Map host→Promise single-flight。
3. hydrate 过期 hit 不丢：stale 先用 + 后台一次刷新。
4. 不做 IDB/Cache API/新依赖/manifest 权限。
5. `node --check ntp/favicon.js`。
6. `but commit -b 12-favicon-cache-hardening -m "perf(favicon): single-flight + SWR hydrate"`
7. `reports/12-favicon-cache-hardening-report.md`。

## 完成定义
票 Acceptance 全勾。
