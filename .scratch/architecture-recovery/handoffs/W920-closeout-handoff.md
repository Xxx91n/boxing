# Handoff — Wave9.20 整轮收口归档（2026-09-15）

> 下一轮入口: 豁免清零 → 发行 G-A CI → G-C Pages → tag/商店另令

## 一句话

Wave9.20 票 107–116 全 implemented 并 land 至 origin/main（tip `2f167ca7`）；G-B 用户声明「测试通过」2026.9.20；硬验收八门+build 本机绿；收口文档改动在本地待 push 明令。

## 必读

| 主题 | 路径 |
|---|---|
| 收口审计 | .scratch/architecture-recovery/reports/W920-closeout-audit.md |
| 遗留 backlog | reports/W920-postrelease-backlog.md |
| W1/W2 首脑复核 | reports/W920-W1-brain-review.md · W920-W2-brain-review.md |
| A 账本 | decision-ledger.md A-062..A-071 · A-P01..03 |
| Grill D 账本 | ../wave9-920-grill/decision-ledger.md |
| 发行状态 | docs/release-status.md |
| 门禁 | docs/adr/0017-release-data-gate.md |
| 产物 | dist/**/boxing-2026.9.20.zip |

## 下一轮建议

1. 跑 main test.yml → G-A；按 105 撤 3 条 F 豁免（C01/C02）
2. G-C Pages version == v2026.9.20（C03）
3. 用户侧 environment 放行 tag（C04）
4. tag/商店另令（C08）
5. 决定 C05/C06/C07 是否立票

## 禁止

- agent 代签 G-B（本轮已由用户声明，不得改写）
- 未明令 push/tag/商店
- force-push / 换 root
- 恢复真实凭据
- 把「G-B 通过」写成「三门达成」直至 G-A+G-C

## Suggested skills

| 场景 | Skill |
|---|---|
| 发行执行 | implement · tdd |
| 复核 | code-review |
| 根因 | diagnosing-bugs |
| 知识收口 | neat-freak · domain-modeling |
| 版本控制 | but |
| 下波规划 | grill · grill-with-docs |
