# 60 — ntp 新开标签零闪现（FART+内容遮罩）（P1）

**What to build:** 新开标签第一帧已是记忆主题/明暗；渲染完成前不出现错误盒子/视口；不解耦记忆。

**Blocked by:** None (can start immediately)

**Status:** done (slow-mo recording evidence pending CI lane — see reports/60-report.md + evidence/60-flash/)

**覆盖 A-xxx:** A-013, A-014（范围 A-012）

- [x] paint-critical 键（至少 theme/darkMode）在持久化成功路径可镜像供首帧；真源仍为 boxingLayout
- [x] head classic 阻塞脚本（非 module、非 inline）同步应用主题；CSP script-src self 合规
- [x] renderCanvas/enterLargeBox 完成前 canvas 以正确主题底色遮罩或 inert
- [x] Chrome+Firefox 新开标签慢放：无默认 beige、无亮暗跳变、无非记忆盒子可见帧
- [x] rememberLastPos 行为不变；清 localStorage 后允许一次性默认主题降级并在说明中记载
- [x] 不改 ADR-0017；不勾 G1–G6；镜像不参与迁移/同步/导出
- [x] 报告含验证命令与慢放证据路径（自建 evidence，不进 G-B 勾选）
