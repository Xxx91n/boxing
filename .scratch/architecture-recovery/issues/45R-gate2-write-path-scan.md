# 45R — data-golden gate2 子串断言改为写路径扫描

**What to build:** 修复 gate2：禁止 `expect(bg).not.toContain('boxingLayout')` 子串检查；改为扫描 background.js 是否 **写** boxingLayout（storage.local.set / storage.sync.set / directSet），允许合法读（t42 COW）。纠正报告 SHA 账本。flip 前必须完成。

**Blocked by:** None — can start immediately（不依赖 42R/43R）

**Status:** done (branch ci/data-golden-gates @ efaeac7; report 返工轮次 45R 节)

## 首脑结论（必须先读）

reports/W2-wave5-brain-review.md 票 45 节。gate2 与 t42 合法读碰撞；ba1e7e9 dangling。

## 验收

- [x] gate2 断言改为写调用/key 扫描；background 读 boxingLayout 不再红
- [x] 实跑 boxing-data-golden.spec.ts：gate2 passed（其余 gate 行为不回归）
- [x] migration-golden 仍 4 passed；pretest 双 guard 仍绿
- [x] 报告追加「返工轮次」：纠正最终 SHA 为真实 tip；写明 gate2 新语义
- [x] issues/45 AC 表述与新 gate2 一致

## 禁止

- 禁止用 not.toContain 当写路径门禁
- 禁止把 t42 的合法读改成「去掉读」来迁就旧断言

## Out of scope

- legacyReader 独立模块升格（记入 46 ADR 即可）
- 主 lane 全量 baseline 红清零
