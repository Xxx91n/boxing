# Handoff — 12 favicon single-flight + SWR hydrate

## 票面
- Issue: issues/12-favicon-cache-hardening.md
- Spec: spec.md Wave4
- 调查: 43-2026-09-12-wave4-investigation.md P4
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/12-favicon-cache-hardening.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/12-favicon-cache-hardening.md
2. spec.md Wave4
3. 43-2026-09-12-wave4-investigation.md P4
4. WORKFLOW.md §4.3（atomcode 串行）
5. AGENTS.md
6. ntp/favicon.js（全文）
7. ctx_search(queries:["favicon SWR single-flight"], source:"atomcode-favicon") — 首脑已完成的工业对比
8. docs/CONTEXT.md

## 本票 delta
- `inflight` Map host→Promise single-flight（失败 Forget）
- hydrate 过期 hit 不丢：stale 先用 + 后台一次刷新
- 保持 URL 字符串元数据、CDN race、防抖持久化、消极缓存
- **禁止**: 新依赖、manifest 权限、IDB、Cache API、`_favicon`
- 文件面: **仅** ntp/favicon.js（+ 可选最小 test）

## 调研依赖（atomcode-research）
中高。首脑已有一轮完整对比（结论写在 issue/调查）。实施前可用下列提示词加赛「single-flight + SWR 在扩展 favicon 的落地细节」，或直接采纳首脑结论。**禁止并行第二个 atomcode**。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展架构调研员，结合本项目 docs/adr 与 docs/CONTEXT.md，并对照已有结论「URL 字符串元数据缓存 + CDN race + 7d/90d TTL 正确，缺 single-flight 与 SWR hydrate」：请深挖工业级 single-flight（in-flight request dedupe）与 stale-while-revalidate 在 Chrome MV3 新标签页 favicon 场景的落地细节——失败广播与 Forget、超时、host key 归一化、hydrate 后台刷新的调度（requestIdleCallback vs 立即）、以及有哪些开源实现可参考。评估是否需要补 Chrome _favicon 权限（注意 Firefox 无此 API）。给出最适合本项目零依赖 vanilla JS 架构的推荐与可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 回报
- 报告: .scratch/architecture-recovery/reports/12-favicon-cache-hardening-report.md
- 报告须写明：是否重跑 atomcode、采纳/修正了首脑哪些结论

## Suggested skills
- atomcode-research
- but
