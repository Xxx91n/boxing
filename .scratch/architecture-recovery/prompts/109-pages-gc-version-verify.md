# 109 pages-gc-version-verify — 窗口启动器

身份: Boxing Wave9.20 实施子窗口 · ticket 109 · covers A-064

## 必读（先读完再动手）

- .scratch/architecture-recovery/handoffs/109-pages-gc-version-verify-handoff.md
- .scratch/architecture-recovery/issues/109-pages-gc-version-verify.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/adr/0017-release-data-gate.md
- docs/CONTEXT.md
- .scratch/architecture-recovery/decision-ledger.md

## 本票 delta

- 检查点: 见 issue AC；完成定义与调研协议见 handoff（不在此复述）
- 专属验收: G-C 升格：version.json 新鲜度 + deploy verify
- Blocked by: None

## 开工第一句

先复述：①本票阻塞/被阻塞关系 ②必读清单路径是否都存在 ③handoff 内通用调研三项。确认无误后再写代码。

## 收尾

报告写入 .scratch/architecture-recovery/reports/109-report.md（含调研摘要、AC 对照、锚点）。
版本控制遵循 WORKFLOW §4.2。完成定义遵循 handoff。
