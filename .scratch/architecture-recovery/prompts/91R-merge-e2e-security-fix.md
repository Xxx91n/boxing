# 91R merge-e2e-security-fix — 窗口启动器

身份: Boxing Wave9 返工子窗口 · ticket 91R · covers A-045（返工 91）

## 必读（先读完再动手）

- .scratch/architecture-recovery/handoffs/91R-merge-e2e-security-fix-handoff.md
- .scratch/architecture-recovery/issues/91R-merge-e2e-security-fix.md
- .scratch/architecture-recovery/reports/W1-brain-review.md
- .scratch/architecture-recovery/reports/91-report.md
- .scratch/architecture-recovery/issues/91-merge-three-way-b55.md
- .scratch/architecture-recovery/WORKFLOW.md
- docs/CONTEXT.md

## 本票 delta

- 检查点: 先复核首脑指出的两条实物缺陷（凭据 L26–28、fileURLToPath L21/23），确认与工作树一致再改
- 专属验收: 无明文凭据；playwright --list 能加载；报告追加 91R；不削弱合并断言
- 镜像: GitHub #11

## 开工第一句

先复述：①首脑两条缺陷的 file:line ②必读路径存在性 ③禁止 force-push/禁止恢复凭据。确认后再编辑。

## 收尾

报告 **追加** 写入 .scratch/architecture-recovery/reports/91-report.md（标题含「返工轮次 91R」）。  
版本控制遵循 WORKFLOW §4.2。完成定义遵循 handoff。
