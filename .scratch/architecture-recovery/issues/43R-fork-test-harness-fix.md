# 43R — crash-rescue fork 返工：写路径防覆盖 + 验收绿跑

**What to build:** 票 43 loadLayout fork 已存在，但 **saveLayout 写路径仍可无归档覆盖损坏主键**（子代理 P0）。返工：(1) saveLayout 在 migrate/merge 前 isPlausibleLayout，失败先 archiveCorruptMain 再恢复，禁止无归档写回；(2) 修 E2E 竞态使 fork 用例绿；(3) issue 状态同步；报告追加返工轮次。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## 首脑结论（必须先读）

reports/W2-wave5-brain-review.md 票 43 节 + 子代理 general-5：
- fork 用例 archiveKeys=0 确定性红
- **saveLayout（storage.js L491–501）无 isPlausibleLayout**，migrateLayout 静默 default 后写回，不写归档键
- 报告 §5「缺 version 可通过」与代码矛盾（version 非数字一律判损）

## 验收

- [ ] 先重跑 data-recovery「Corrupt main key」用例，贴 1 failed 基线
- [ ] **产品修复**：saveLayout 读到非 plausible boxingLayout 时先 archiveCorruptMain，禁止无归档覆盖（与 loadLayout 同一语义）
- [ ] legacy 路径 loadLayout 写主键前同样不得吞掉待归档载荷
- [ ] 修复 harness 竞态（unload flush / 写链）后用例绿：归档键存在、raw 可读、主键重建、pageErrors=[]
- [ ] data-recovery.spec.ts 全文件 passed（贴原始输出）
- [ ] node --check + import-graph-guard 绿
- [ ] issues/43 Status/checkbox 与实物一致（绿跑后才 done）
- [ ] 报告追加「返工轮次 43R」，不覆盖原记录；纠正 §5 与 isPlausibleLayout 矛盾表述

## 禁止

- 禁止只改测试不改 saveLayout 写路径
- 禁止无绿跑宣称 done

## Out of scope

- 44 合并语义
- 启动弹窗 UI（保持设置数据区入口）
