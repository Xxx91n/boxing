# 43R — crash-rescue fork 验收测试返工

**What to build:** 票 43 产品代码（archiveCorruptMain / isPlausibleLayout / loadLayout fork / refreshDataHealth / i18n）已存在。返工窗只修验收：fork Playwright 用例 archiveKeys>0；issue 状态与勾选同步；报告追加返工轮次。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## 首脑结论（必须先读）

reports/W2-wave5-brain-review.md 票 43 节。fork 用例 archiveKeys.length=0。

## 验收

- [ ] 先重跑 data-recovery「Corrupt main key」用例，贴 1 failed 基线
- [ ] 修复 harness：避免旧页 unload saveLayout 覆盖损坏 seed（中和 flush / 新 context 直 seed / 禁止首 boot 写回）
- [ ] 用例绿：归档键存在、raw 可读、主键重建、pageErrors=[]
- [ ] data-recovery.spec.ts 全文件 passed（贴原始输出）
- [ ] node --check storage/utils/settings-ui/i18n + import-graph-guard 绿
- [ ] issues/43 Status/checkbox 与实物一致
- [ ] 报告追加「返工轮次」节，不覆盖原记录

## 禁止

- 禁止把 beforeunload 覆盖当成「产品不需要归档」
- 禁止无绿跑宣称 done

## Out of scope

- 44 合并语义
- 改 isPlausibleLayout 误报面（除非测试证明误伤）
