# Spec — Wave9.15 发行收口 + B 轨全完成

> 唯一数据源: `.scratch/wave9-915-release-grill/decision-ledger.md` D-001..D-009
> 目标版本: **2026.9.15** · origin/main 基线 `9fa4666c`（中间 G-A 已绿，非发行终谳）

## Problem Statement

Wave9 实施与收口已 land（R1–R3 修绿、B55 三向、版本面 2026.9.15），tip `9fa4666c` 上 test.yml run `34808080000` 全绿。但：

1. GitHub #10/#11/#12 仍 open，与已满足的 AC 不符（D-002/D-005）。
2. `AI Docs Governance` dead-link 红仍在 main 治理面（D-003①）。
3. 锐评 6/8 与 B63–B70 未收；用户要求「所有内容都要完成」（D-003）。
4. B 轨再 land 会改变 tip → 发行 G-A 必须对**新 tip** 重跑（D-004）；G-B/tag 边界须防越权（D-007）。

## Solution

按 D-006 五段完成 B 轨全部 11 项 → 新 tip 发行 G-A 全绿 → 等待用户 G-B（2026.9.15+日期）→ tag/商店另令。#10–12 在定稿后立即关闭并留证据。

## User Stories

- 作为维护者，我读 docs/ 层 Release status 就能知道当前版本、三门状态与在效欠账，而不必潜入 .scratch。
- 作为 CI，AGENTS/CONTEXT 的 agent/history 链接不再被 dead-link 误杀，main 治理面恢复绿。
- 作为后续 agent，`ntp.js`/`i18n.js` 现场能看到冻结注释与票号指针。
- 作为用户，9.15 发行 zip 在你声明 G-B 之前不会被 agent 宣称可发行或自动 tag。

## Implementation Decisions

- **主序**（D-006）：①治理灭红（docs-gov + B64）→ ②产品/注释（锐评8 + B68 + B66）→ ③测试（B65 + B70）→ ④文档（锐评6 + B63 + B67 + B69）→ ⑤新 tip test.yml 发行 G-A → 等 G-B。
- **票务**（D-008）：GitHub = docs-gov、B65、B68、B66；scratch = 锐评6/8、B63/B64/B67/B69/B70。
- **G-A**（D-002/D-004）：`34808080000` = 中间里程碑；发行终谳 = B 轨 land 后新 tip 四 job 全绿。
- **G-B**（D-007）：用户对新 tip 发行 zip 声明 pass（2026.9.15+日期）；禁止 agent 代签。
- **tag/商店**（D-007）：不在本实施波授权。
- **历史**（D-001 负向，沿用前序）：origin/main 线性追加，不换 root、不 force-push 手术。

## Testing Decisions

- 发行 G-A = 对最终 tip 的 `test.yml`：data-golden + ubuntu/macos/windows 全绿（D-004）。
- B65 deflake 后相关 spec 不得只靠 skip 冒充绿；B70 无复现也须书面观察结论（D-003⑪/D-006③）。
- docs-gov 修绿以该 workflow conclusion=success 为证，不与 G-A 混写（D-002/D-005 负向）。

## Out of Scope

- B61 用户 G-B 执行本身；B62 发行后 G-C；tag；商店上传；9.12 热修；无关重构（D-003 负向）。

## Further Notes

- 前序 Wave9 实施账本 A-040..A-049 与 postrelease D-001..D-010 保持 current，本 spec 不重写其结论。
