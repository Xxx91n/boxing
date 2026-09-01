# Spec — ntp.js 按不变量边界的 strangler-fig 拆分

状态: ready-for-agent (本地 tracker, 无 label 系统)
来源: research-report.md (2026-08-31 atomcode 调研) + WORKFLOW.md

## Problem Statement

ntp/ntp.js 是 6055 行 / 312KB 的单 IIFE classic script。治理其可修改性靠 28KB AGENTS.md 的条文 (BX-DEV/A1-A5 禁令等), 实证表明此类规则每会话征税 (arXiv:2602.11988: 推理成本 +20%+)。测试套件留有 9 个已知 flaky test, 可信度被持续放血。用户 (维护者与未来的 agent) 无法以合理成本安全地修改这个文件。

## Solution

将 ntp.js 按不变量边界增量拆分为原生 ES module (零构建, strangler-fig 顺序): 边缘域先行验证流水线, 状态收敛居中, 存储门面整体迁移不得拆散, 渲染主内聚最后。同时先把 flaky test 隔离/修复, 使每次拆分有可信的绿灯。模块边界落地后薄化 AGENTS.md, 让失效的规则失效。

## User Stories

1. As a 维护 agent, I want 每个领域一个模块文件, so that 我按需读文件而非全量吞 312KB + 28KB 规则。
2. As a 维护 agent, I want 存储写入门面单模块, so that 多标签同步一致性不被拆分破坏 (storageWriteChain / applyingExternalLayout / onChanged 不拆散)。
3. As a 维护 agent, I want 共享闭包状态收敛为显式 state 模块, so that ESM live binding 下不出现两份状态各活各的。
4. As a 维护者, I want flaky test 被隔离或修复, so that 每次拆分的绿是可信的绿。
5. As a 维护者, I want 拆分后有调用图扫描产物, so that 机械搬移不因隐式跨函数依赖炸出 ReferenceError。
6. As a 维护者, I want index.html 切换到 `<script type="module">` 后扩展在 Chrome/Firefox 均工作, so that 双浏览器发布管道不受影响。
7. As a 维护者, I want file:// mock 的失效被显式处理或记录在案, so that 不有人在 ESM 化后被静默断掉的调试路径坑。
8. As a 维护者, I want AGENTS.md 在模块边界落地后薄化, so that token 税随结构进步而退欧。
9. As a 发布者, I want 每次拆分 `npm run build` + `npm test` 均绿, so that dist 产物与 manifest 契约始终可发布。
10. As a 产品决策者, I want 定位结论 (受众/叙事/渠道) 被记录在报告, so that 后续增长工作有据可依。

## Implementation Decisions

- 模块路线: 裸 ES module, 零构建 (V8 指南在扩展场景豁免 bundle 税; Vantage 先例)。不引入打包器。
- 拆分顺序 (strangler-fig, Fowler 铁律): favicon 缓存块 → i18n 字典 → 纯工具函数 → state 模块 → storage 写入门面 → 布局持久化 → 渲染主内聚 (renderCanvas 系) → AGENTS.md 薄化。
- 存储方案不重新选型: 维持 storage.local (ADR A6 已锁定); 拆分只动结构不动存储区。
- 共享状态策略二选一, 实施时按调用图决定: (a) 入口模块持有并于 init 注入; (b) 独立 state 模块 (ESM 单例语义保证一次求值)。禁止两模块各持副本。
- file:// mock: 首票处理 — 保留 mock 但以动态可运行方式兼容 module, 或记录 file:// 调试路径废止 (写入 WORKFLOW §6 教训)。
- 验证门槛: 每票 `npm test` + `npm run build` 绿; manifest 契约不变 ( Manifest Source-of-Truth 契约, AGENTS.md §238)。
- 版本控制遵循 WORKFLOW §4.2。
- 测试缝 (seam): 最高缝 = 现有 Playwright 扩展上下文 E2E; 不新增测试框架。拆分验收复用现有 E2E (鸟趶整个画布交互路径)。

## Testing Decisions

- 好测试标准: 只测外部可观察行为 (画布交互 / 持久化往返 / i18n 渲染), 不测内部结构 (模块文件名单不构成测试)。
- 被测模块: 存储门面 (读写往返 + 多标签防回环)、i18n (语言切换)、favicon (缓存命中/过期)。
- 先决: 9 个 flaky test 隔离 (标记 + quarantine 列表) 或修复, 在拆分开始前完成 — 否则重构绿灯不可信。
- 现有 Playwright 套件 (test/playwright.config.ts, chromium + firefox 双 project) 为所有拆分类票的回归门槛; 不新增 seam。

## Out of Scope

- 引入打包器 / 框架 / TypeScript。
- 变更 storage 区域选型、manifest 权限、UI/UX 设计。
- 产品增长执行 (定位结论仅入 research-report.md, 非本 spec 交付物)。
- 服务端 / 账号体系。

## Further Notes

- 拆分完成后, BX-DEV/A1-A5 禁令类规则预期大面积自然失效; 届时 AGENTS.md 薄化是独立一票。
- 若中途发现调用图复杂度远超预期 (state 模块无法干净收敛), 停 — 回到大脑窗口重新裁决, 不硬搬。
