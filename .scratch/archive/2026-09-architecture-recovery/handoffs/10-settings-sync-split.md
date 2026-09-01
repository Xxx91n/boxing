# Handoff 10 — settings/init 域拆分

## 目标
settings/init ~1800 行按四层模型拆为 sync-engine / credentials / settings-ui / onboarding 四模块。

## 上游上下文
- 验收单: ../issues/10-settings-sync-split.md
- 调研依据: atomcode 心智模型调研 (ctx source: atomcode, 搜 'SyncEngine' / '四层' / 'outbox'); callgraph-report.md §7.2 第6条 (本缺口来源)。
- 工业模型: storage=port, WebDAV/Gist=adapter, sync 是门面消费者不是门面一部分; 凭据 envelope 加密分拆不改算法 (现状已合规)。

## 完成定义
issues/10 的全部验收项勾选, WebDAV 同步与凭据加密手动往返验证一次。

## 注意事项
- 拆 sync-engine 前先落地 ADR-0016 草案 (编号已被调研预占)。
- updatedAt LWW 是已知妥协, 不要在本票顺手"修复"它 — ADR-0016 另行裁决。
