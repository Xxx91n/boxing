# Ticket 42 — onInstalled(update) 先 COW 快照再迁移 报告

**Date:** 2026-09-11
**Status:** Implemented (CI run pending — 本机遵守 CI-only 政策，测试证据以 CI run/artifact 为准)
**Blocked-by state:** 41 已 done（reports/41-snapshot-key-split-rotation-report.md）→ saveSnapshot/listSnapshots/restoreFromSnapshot 已在 ntp/storage.js 落地，本票在其上实施，阻塞解除。
**Branch/commit:** `ticket-42-update-cow-before-migrate` @ ylp（版本控制遵循 WORKFLOW §4.2）

## 1. 完成定义对照

完成定义 = 遵循 issues/42-update-cow-before-migrate.md 全部验收项 + 报告落盘。

| 验收项 | 证据 |
|---|---|
| background onInstalled reason=update 路径先快照后迁移（代码顺序可审查） | background.js: `details?.reason === "update"` 分支内 `await takePreUpdateSnapshot()` 是该分支第一副作用，之后才写 boxingInstallSignal；迁移（migrateLayout）只在 NTP 门面 loadLayout 运行，恒晚于该快照。SW 侧 self-contained COW：读 boxingLayout → 剥 groups（ADR-0007 Q1）→ 深拷贝写 `snap.v1.<ts>`（ADR-0009/41 分键形态）→ index 追加+有界 40 条。classic SW（dual manifest，无 type:module）不能 import NTP ESM 门面——见 §3 设计决策 D-A。 |
| NTP 看到 update 信号且待迁移时先快照 | ntp/storage.js 新增 `ensurePreUpdateSnapshot()`：update 信号 + `needsMigration(raw)` 为真 → `setLayout(raw)`（未迁移原文）→ `saveSnapshot()`（pre-update schema）→ `loadLayout()` 再迁移。ntp/ntp.js init() 将 `consumeInstallSignal()` 从 init 尾部上移至 `loadLayout()` 之前，reason 变量复用给 initOnboarding（行为不变）。 |
| 单测/集成：模拟 update 后存在 pre-update 快照且 schema 已升 | test/tests/boxing-update-cow-before-migrate.spec.ts（3 用例，file:// mock 车道/SEC-01）：T42-1 update 信号+legacy 形态 → 存在 pre-update 快照（保留旧形态 settings 缺失/isParent 未 backfill）+ 主键已迁移（settings 补全/__groupsMigrated/props/isParent）；T42-2 update 信号+已迁移形态 → 零冗余快照；T42-3 无信号 → 零快照且迁移路径不回归。**本地未跑**（CI-only），待 CI 执行。 |
| file:// 无信号路径行为不回归 | T42-3 + 信号缺失时 installReason=null → ensurePreUpdateSnapshot 不调用；mock 车道 consumeInstallSignal 读 `bxstore:boxingInstallSignal` 返回 null（41R mock 前缀语义未动）。onboarding 既有四条 file:// 测试的 legacy 判定不变（onboarding spec 不种子信号，grep 已核）。 |

## 2. 代码改动面

- `background.js` — onInstalled(update) 先 COW：新增 `takePreUpdateSnapshot()`（SW_SNAP_KEY_PREFIX/INDEX_KEY/MAX_BYTES/INDEX_CAP 常量 + split-key 写入 + index 有界追加）。
- `ntp/storage.js` — 新增 `ensurePreUpdateSnapshot()` + `needsMigration()`（ADR-0007/0009 白名单式"待迁移"检测：v<3 / boxes 非数组 / settings 缺失 / groups 残留 / __groupsMigrated 未盖章 / connections 缺 props）。设计注：migrateLayout 无版本门控且**原地改写盒子对象**（isParent/props backfill 落在 raw.boxes 引用上），对同一对象做 JSON diff 检测不到"待迁移"，故用字段白名单。
- `ntp/ntp.js` — import 增加 ensurePreUpdateSnapshot；init() 头部先 consume 信号、update 时先快照再 loadLayout；init 尾部删除重复消费（仅保留 initOnboarding，复用头部 reason）。
- `test/cluster-map.json` — 新 spec 登记进 `ntp/ntp.js` + `ntp/storage.js` 两个 cluster（CM-1 门禁通过）。
- `test/tests/boxing-update-cow-before-migrate.spec.ts` — 新增（见上）。

## 3. 设计决策（atomcode 调研对照，22 源基线 2026-09-11 任务书，本票调研 12 检索/14 全文/10 独立域名）

调研经 ctx_batch_execute 串行执行（§4.3），结论 Confidence 高，与本票实现**完全同构**，无返工：

- **D-A｜SW 侧自包含 COW（不 import 门面）**：C2/C6 佐证——MV3 onInstalled 是唯一官方迁移钩子但结构性不可靠（evict 可中断、禁用期更新不触发，官方 bug 41116832）；Chrome Enterprise 快照**不含扩展自身 storage**（C6），扩展数据必须自建保护。background 是 classic script（dual manifest Firefox 兼容，无 type:module），无法 import storage.js ESM；SW 上下文也无 layout 内存态/facade 注入（D-layering 约束），故内置最小 COW（键形态与 NTP 门面一致，轮转归属 41 门面，SW 仅 append+cap 防膨胀）。
- **D-B｜NTP 兜底即"每个入口 ensureMigrated"**：C2 建议的兜底通道在本项目自然落位——迁移在 NTP loadLayout 每次打开幂等执行，init 头部的 ensurePreUpdateSnapshot 就是"打开即先 COW 再迁移"的入口闸门；SW 快照失败/被 evict 腰斩时由它补拍。
- **D-C｜raw 先快照再迁移**：`setLayout(raw)`（未迁移原文）→ saveSnapshot → loadLayout 覆盖迁移，保证兜底快照也是 pre-update 语义；C3 一致——快照/中间态全走 storage.local（snap.v1.*），不碰 session/sync。
- **D-D｜已迁移数据不重拍**：needsMigration 白名单判定为假时跳过，避免每次 update 冗余 COW（C1 语义仍在：SW 侧无条件 COW 承担"升级前必留副本"，NTP 侧只补"确有迁移"）。
- 轮转保留策略：41 门面 RAW_KEEP_FLOOR=10 + 分层轮转 + 8MB 总预算已固化（ADR-0009/41），本票不复制轮转算法；对齐 Chrome Enterprise 的"保留数份"由门面 floor 满足。

## 4. 验证（本机静态；CI-only 政策下运行时测试证据待 CI run）

- `node --check background.js | ntp/storage.js | ntp/ntp.js` → 均 exit 0。
- `git diff --check` → 干净（无 CRLF/whitespace 错误）。
- `node scripts/import-graph-guard.mjs` → ok（14 modules / 48 edges / 0 violations；新 spec 已在 cluster-map 登记）。
- `node scripts/migration-golden-guard.mjs` → ok（28/28）。
- `npm test`（Playwright full suite / pretest 双 guard）：**未本地执行**——2026-09-04 CI-only 用户 mandate，由大脑 Agent 推送本分支触发 CI workflow 后以 CI run 为准。新 spec 3 用例为本次新增覆盖面。

## 5. 局限与风险（如实记录）

1. **禁用期更新无信号 → 无 pre-update 快照**：官方 bug 41116832（禁用期间 update 不触发 onInstalled，boxingInstallSignal 亦不写）→ SW/NTP 均无 update 依据。超出本票验收面（验收均基于信号存在）；社区兜底 management.onEnabled 需额外权限且非官方承诺，不在本票范围。
2. **SW/NTP 并发写 snap.v1.index 的极小窗口**：onInstalled 早期 NTP 页若恰在 saveSnapshot，索引读-改-写可能互相覆盖 → 该 body 键成孤儿（不入 index，NTP 轮转不清理）。概率极低（更新重载期 NTP 旧上下文通常不写）、storage.local unlimited 下占空间可忽略；不引入跨上下文锁（重量级，违背门面边界）。
3. **SW 侧 index 只 append+cap（40 条），不做分层轮转**：分层轮转是 41 门面的职责；SW cap 仅防目录无限膨胀。两处 index 形态一致（{ts,schemaVersion,size}）。
4. **needsMigration 白名单是保守启发式**：未来新增迁移类型（如新的 schema 字段迁移）需同步扩展白名单；误报只会多拍一份快照（COW 精神：宁多勿少），漏报需测试矩阵兜底（D5 golden fixture + 迁移单测在 pretest 门禁中）。

## 6. 遗留

- CI 验证（full suite + 新 spec）待触发；合并/收口门按 spec D7（CI 全绿 + 人工黄金路径 + Pages 200）。
- alarms 定时备份路径未动（spec 要求保持）。