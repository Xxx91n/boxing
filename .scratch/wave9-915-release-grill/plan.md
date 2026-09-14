# Plan — Wave9.15 B 轨实施 + 发行门

> 数据源: 本目录 decision-ledger.md · spec.md · destination-reconciliation-wave915.md

## 波次表（D-006 主序，权威）

| 段 | 内容 | 票 | 依赖 |
|---|---|---|---|
| 0 | 关 #10/#11/#12（D-002/D-005） | 执行动作 | 无 |
| ① 治理 | docs-gov 死链修绿；B64 calver 门禁 | #13 · 04-B64 | 无 |
| ② 产品/注释 | 锐评8 冻结注释；B68 boot failsafe；B66 对比度 | 02-rui8 · #15 · #16 | ① 可并行但主序在后 |
| ③ 测试 | B65 deflake；B70 观察结论 | #14 · 10-B70 | ② 后 |
| ④ 文档 | 锐评6 Release status；B63 locale；B67 DESIGN；B69 判据 | 01-rui6 · 03-B63 · 07-B67 · 09-B69 | ①–③ 可穿插，收口在④末 |
| ⑤ 发行 G-A | 新 tip test.yml 全绿（D-004） | 执行动作 | ①–④ 全 land |
| 出口 | 等待用户 G-B（D-007）；G-C/tag 另令 | — | ⑤ 绿 |

## 票务索引（D-008）

### GitHub Issue（定稿后创建）

| Issue | 对应 | 段 |
|---|---|---|
| GH-docsgov | AI Docs Governance dead-link 修绿 | ① |
| GH-B65 | fire-and-forget 测试族 deflake | ③ |
| GH-B68 | boot-theme 早退 failsafe | ② |
| GH-B66 | 亮色 bm-add-btn 对比度 | ② |

### Scratch 票（本目录 issues/）

| 文件 | 对应 | 段 |
|---|---|---|
| 01-release-status-rui6.md | 锐评6 | ④ |
| 02-frozen-comments-rui8.md | 锐评8 | ② |
| 03-locale-readme-b63.md | B63 | ④ |
| 04-calver-guard-b64.md | B64 | ① |
| 07-design-hairline-b67.md | B67 | ④ |
| 09-unflaky-criteria-b69.md | B69 | ④ |
| 10-innerclip-b70.md | B70 | ③ |

## 出口边界（D-007）

- 实施波完成 ≠ 可发行宣称。
- 发行 G-A 必须是 **B 轨 land 后新 tip** 的 test.yml 全绿。
- G-B 仅用户；tag/商店另令。
