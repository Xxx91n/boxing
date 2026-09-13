# 95 credential-sweep-specs — 窗口启动器

身份: Boxing Wave9 实施子窗口 · ticket 95 · covers A-049

## 必读

- .scratch/architecture-recovery/handoffs/95-credential-sweep-specs-handoff.md
- .scratch/architecture-recovery/issues/95-credential-sweep-specs.md
- .scratch/architecture-recovery/reports/91-report.md
- test/tests/boxing-merge-three-way.spec.ts（91R 模板）
- .scratch/architecture-recovery/WORKFLOW.md

## 本票 delta

- 检查点: 先 grep 全量命中清单，再逐文件 env 化
- 专属验收: test/ + .codex-tmp/ 工作树 0 明文；--list 可加载
- 镜像: 无

## 开工第一句

先复述：①命中文件列表 ②91R 模板三行常量 ③禁止恢复真实凭据。

## 收尾

报告写入 .scratch/architecture-recovery/reports/95-report.md。  
版本控制遵循 WORKFLOW §4.2。
