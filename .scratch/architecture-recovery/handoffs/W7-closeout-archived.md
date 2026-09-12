# Handoff — Wave7 归档 / 下一轮开工

日期: 2026-09-12 · 状态: Wave7 实施票 60–66 源码面完成；合并待 push 明令

## 0. 一句话

零闪现+发行卫生+锐评 triage 已落地并过硬验收；G-B 仍阻塞发行；栈已就绪未 push。

## 1. 必读（按序）

1. .scratch/architecture-recovery/reports/W7-closeout-audit.md
2. .scratch/architecture-recovery/reports/W1-brain-review.md
3. .scratch/architecture-recovery/reports/W2-brain-review.md
4. .scratch/architecture-recovery/decision-ledger.md（Wave7 结算）
5. docs/history/2026-09-12-wave7-closeout-backlog.md
6. .scratch/architecture-recovery/README.md（状态表）
7. .scratch/wave7-flash-grill/decision-ledger.md（D-001..D-004）
8. docs/CONTEXT.md · docs/adr/0017 · AGENTS.md · WORKFLOW §4.2/§4.4
9. .scratch/architecture-recovery/evidence/49-g-b-manual-golden-path/

## 2. 下一轮建议焦点

1. 用户明令 land+push Wave7 栈（B46）
2. 补勾 issue AC（B40）+ 60 慢放（B41）
3. G-B 实机（B42）→ #9 close（B43）
4. 可选: B45 flaky · B47 i18n README 同步

## 3. Suggested skills

- **but** — land/push（§4.2；push 需明令）
- **playwright** — 60 慢放/记忆回归、G-B
- **atomcode-research** — 仅残红/商店政策再调研（串行）
- **grill / to-spec / to-tickets** — 若 backlog 立新波
- 项目内: ADR-0017 · WORKFLOW §4.4 · evidence/49 · decision-ledger

## 4. Redaction

无 API key/密码；CRED 字面量为公开承重常量（票 63 已诚实标注）。

## 5. 红线

- G-B 前禁 tag / 禁宣称可发行
- 不扩 ADR-0017；闪现不解耦记忆
