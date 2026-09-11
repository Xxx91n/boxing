# Ticket 43 — crash rescue 改为 fork：归档损坏主键再重建 报告

**Date:** 2026-09-11
**Status:** Implemented (CI run pending — 本机遵守 CI-only 政策，测试证据以 CI run/artifact 为准)
**Blocked-by state:** 41 已 done（reports/41-snapshot-key-split-rotation-report.md + 41R）→ saveSnapshot/listSnapshots/restoreFromSnapshot/getLatestSnapshot 已在 ntp/storage.js 落地，本票在其上实施，阻塞解除。
**Branch/commit:** `ticket-43-crash-rescue-fork` @ qun（版本控制遵循 WORKFLOW §4.2）

## 1. 完成定义对照

完成定义 = 遵循 handoff 内的完成定义（issues/43-crash-rescue-fork.md 全部验收项 + 报告落盘）。

| 验收项 | 证据 |
|---|---|
| 损坏 JSON 被归档且仍可从 storage 读出 | ntp/storage.js 新增 `archiveCorruptMain(raw, error)`：可读但 `isPlausibleLayout` 校验失败的主键载荷 verbatim 写入 `boxingLayout.corrupt.<ts>`（entry.raw 保留原值 + {ts, error, size} 元数据）；单条 ≤2MB（MAX_SNAPSHOT_BYTES，超限降级 truncated 仅存元数据，SEC-06 防 OOM 同款心智）。测试断言 archived.raw 保留损坏载荷且可 JSON.parse 读回。 |
| 主键从健康快照重建后应用可启动 | loadLayout fork 路径：归档后 `crashRescue()`（41 的 getLatestSnapshot→migrateLayout）→ `setLayout(rescued || defaultLayout())` → 主键持久化写回（防止每次启动重复归档）；无快照时落 defaultLayout。测试断言重建后主键 boxes 为数组 + #canvas/#canvas-surface attached + 零未捕获异常。 |
| 设置-数据区显示快照数量与最近备份时间 | ntp/index.html tab-data 新增 data-health section（#data-snapshot-count / #data-last-snapshot-time / #data-corrupt-row）；ntp/settings-ui.js 新增 `refreshDataHealth()`，经 storage 门面 listSnapshots()/listCorruptArchives()（ADR-0016 feature→leaf 向下边，守卫白名单内）在每次 openSettingsModal 时 fire-and-forget 刷新；损坏归档行仅在存在归档时显示（ABP 一次性教训：持久入口、不做启动弹窗）。 |
| Playwright：注入损坏主键 → 启动 → 不抛未捕获异常且归档键存在 | test/tests/data-recovery.spec.ts 新用例 "Corrupt main key is archived (fork) and app still boots"：file:// mock 车道种子 `{version:99, boxes:{bad:true}}`（mock get 会吞 parse 错误返回 null fallback，故用"可 parse 但结构非法"形态触发 fork）→ reload → pageerror==[] + `bxstore:boxingLayout.corrupt.*` 存在且 raw 可读 + corrupt.index 更新 + 主键已重建。**本地未跑**（CI-only），待 CI 执行。 |

## 2. 代码改动面

- `ntp/utils.js` — 新增纯函数 `isPlausibleLayout(raw)`（对象 + 数字 version + boxes 数组）。设计注：migrateLayout 对非法载荷**静默降级为 defaultLayout**（无 version → return defaultLayout()），这正是"无归档覆盖损坏主键"的根因，故损坏判定必须在迁移之前完成；判定只捕获明确结构损坏，正常 v2/v3/v3.5 布局恒通过，无误报。导出列表已登记。
- `ntp/storage.js` —
  - loadLayout 重构：corruptRaw/corruptErr 提升至函数作用域（原 catch 拿不到 try 内的 data 引用，无法归档）；get 成功但校验失败 → fork；get reject（API 层损坏）→ 载荷不可读、无法归档（ABP #6599 边界），仅恢复。
  - 新增 corrupt 归档区：`CORRUPT_PREFIX`/`CORRUPT_INDEX_KEY`/`MAX_CORRUPT_ARCHIVES=20` 常量、`_readCorruptIndex()`、`archiveCorruptMain()`（verbatim 归档 + 索引追加 + 最旧淘汰）、门面导出 `listCorruptArchives()`。
  - fork 路径主键写回用 layoutStorage.set 直写：loadLayout（ntp.js init L832）先于 registerStorageOnChanged（L1016），启动路径无 onChanged 回环；且合并写（saveLayout 的 mergeConcurrentLayout 会读损坏 remote）语义上不适于恢复路径。
- `ntp/index.html` — tab-data 数据健康 section（5 个 id + 5 个 data-i18n 键 + 注释说明 ABP 入口模式）。
- `ntp/settings-ui.js` — import 门面 listSnapshots/listCorruptArchives；新增 `refreshDataHealth()`；openSettingsModal 接入刷新。
- `ntp/i18n.js` — I18N_FALLBACK 增 5 键（BX-I18N-005 fallback 全覆盖）。
- `_locales/<14 locales>/messages.json` — 5 键全量同步（en 原文；zh_CN/zh_TW/ja/ko/de/fr/es/pt_BR/ru/vi/th/ar/hi 人工文案；A7 键一致性预检 PASS；UTF-8 无 BOM 已核；round-trip 格式一致，diff 仅新增块）。
- `test/tests/data-recovery.spec.ts` — 新增 fork 归档用例（见 §1 表末行）。

**文件面偏差说明**：任务书文件面写 ntp/persist.js，但 loadLayout/crashRescue 实际在 ntp/storage.js（41 落地时按 ADR-0016 归位于 storage 门面——唯一允许触碰 layoutStorage 的 NTP 模块）。本票 delta 按代码实际位置实施于 storage.js；persist.js 无涉、未改动。

## 3. 设计决策（atomcode 调研对照）

调研经 ctx_batch_execute 串行执行（§4.3；handoff 推荐提示词 verbatim；source=atomcode 双份索引：22 源基线 + 本票 19 源增量），结论与本票实现同构，无返工：

- **D-A｜fork 双通道**：atomcode 结论"fork 必须在写路径上做（快照），quarantine 是读路径上最后的抢救机会"。写路径快照已由 41（saveSnapshot）+ 42（pre-update COW）落地；本票补齐读路径 quarantine（可读损坏 → 归档 → 重建 → 写回），spec D3 闭环。
- **D-B｜API 层不可读边界**：ABP #6599——LevelDB 损坏时 get() reject、载荷字节不可达，扩展无法归档读不出来的载荷。本票 get-reject 分支不伪造归档，仅 crashRescue/default + 设置数据区入口可见；隔离（archiveCorruptMain）只作用于"可读但校验失败"的载荷。
- **D-C｜容量纪律**：atomcode"隔离键也是数据，计入 QUOTA_BYTES，需容量上限（建议 50 条）"——本票取 20 条 + 最旧淘汰；单条沿用 2MB（MAX_SNAPSHOT_BYTES）上限，超限降级为仅元数据（truncated 标记），与 SEC-06 防 OOM 精神一致。
- **D-D｜一次性提示**：ABP 3.0.3 教训——损坏存储下"每次启动检查"页面反复弹窗导致 uninstall 上升。本票不做启动弹窗；设置数据区的损坏归档行是持久入口，仅在有归档时可见（事件驱动式可达性）。
- **D-E｜索引键同构**：boxingLayout.corrupt.index 只存轻量元数据（{ts,error,size,truncated}），与 41 的 snap.v1.index 同构，设置页展示不拉快照体/归档体。

## 4. 验证

- 语法：node --check ntp/{storage,utils,settings-ui,i18n}.js 全部 exit 0。
- 空白/行尾：git diff --check 干净（LF 仓库约定未破坏）。
- i18n：A7 等价预检（en↔13 locales 键集合双向 diff）PASS；14 locale + I18N_FALLBACK 键齐全；BOM 检查干净；messages.json round-trip 格式一致（diff 仅新增块）。
- 语义自检（ctx 只读扫描）：HTML id/data-i18n ↔ settings-ui 查找 ↔ fallback 键三方对齐；storage.js fork 关键片段就位；import-graph 无新边类型（settings-ui→storage 为既有合法 feature→leaf 向下边）。
- Playwright：本地未跑（CI-only 政策），测试证据以 CI run/artifact 为准。
- codegraph sync 已执行（4 added / 10 modified）。

## 5. 剩余风险与交接

- **默认布局兜底的语义**：无健康快照时主键重建为 defaultLayout，用户原数据仅在 corrupt 归档键中（符合 spec D3"归档不丢"，但用户需从设置数据区感知）；"从 corrupt 归档导出/一键恢复"UI 不在本票验收范围，留待后续票（数据区已具备入口挂点 #data-corrupt-row）。
- **mock 车道局限**：不可 parse 的 JSON 在 mock get 被吞为 null fallback，fork 自动化测试只能覆盖"可读损坏"形态；API 层损坏（ABP 情形）无法在 file:// 车道注入，建议人工验收或扩展车道补一轮真实 storage.local 损坏注入。
- **误报面**：~~isPlausibleLayout 允许 version 缺失但 boxes 为数组的载荷通过（交由 migrateLayout 兜底），避免对未知历史格式误归档；仅 version 非数字或 boxes 非数组判定为损坏。~~ **[43R 勘误 — 上句与代码矛盾]** `isPlausibleLayout` 要求 `typeof raw.version === 'number'`，version 缺失即 `typeof undefined !== 'number'` → **一律判损**，不放行、不兜底。首脑 general-5 判定正确：version 缺失/非数字、boxes 非数组、非对象三种形态全部拦截进 fork 归档。

## 6. 教训（写回候选，WORKFLOW §6）

无新增反模式。既有教训复用确认：migrateLayout 静默降级陷阱与 42 票"migrateLayout 原地改写对象"同源（迁移函数对非法输入的不对称行为是 crash-rescue 语义的隐形前提，票面评审时应作为必查项）。

## 返工轮次 43R — 写路径防覆盖 + 测试 harness 竞态修复（2026-09-11）

**触发**：reports/W2-wave5-brain-review.md 票 43 **FAIL**（V5-43-1 状态矛盾 / V5-43-2 未绿跑 + 产品 P0：saveLayout 可无归档覆盖损坏主键）。任务书：prompts/43R-fork-test-harness-fix.md。

### 基线重跑（验收项 1，1 failed 原始输出）

```
1) [chromium-extension] › test\tests\data-recovery.spec.ts:250:3 › Data Recovery & Export/Import › Corrupt main key is archived (fork) and app still boots
    Error: expect(received).toBeGreaterThan(expected)
    Expected: > 0
    Received:   0
      > 280 |     expect(archiveKeys.length).toBeGreaterThan(0);
  1 failed
  4 passed (17.7s)
```
（与首脑 FAIL archiveKeys=0 一致；日志可见旧页 unload flush 的 `saveLayout called, boxCount=3` 正在覆盖 seed。）

### 产品修复（P0，禁止只改测试）

- **saveLayout 写路径防覆盖**（ntp/storage.js）：读链内 `stored.boxingLayout` 非 plausible 时**先 `archiveCorruptMain`**（error 标注 `saveLayout: stored boxingLayout failed integrity check`），remote 视为 null 不参与 merge，随后写回的是本地内存态——归档先行，无归档覆盖被禁止；合法载荷行为不变（migrateLayout → mergeConcurrentLayout）。与 loadLayout 读路径同一 fork 语义。
- **legacy 路径顺序修复**（loadLayout legacy sync 分支）：损坏 legacy 载荷此前会在归档前被 `layoutStorage.set` 写回主键（吞掉待归档载荷的顺序违规）。修复：写回 + A6 sync cleanup 移入**合法分支**；损坏载荷交给 fork 统一路径（archiveCorruptMain → crashRescue 重建 → 持久化写回），sync 侧原始副本保留（归档轮转 20 条兜底）。

### harness 竞态修复

1. **unload flush 竞态**（archiveKeys=0 的直接根因）：原 boot→setItem(corrupt)→reload 模式下，旧页 pagehide flush（flushPendingViewStatePersist → saveLayout）用内存合法 layout 覆盖刚注入的损坏 seed，新页 never sees corrupt。修复：**addInitScript 预导航注入**（首次 goto 前就位，单 goto 无 reload，无 unload flush 窗口），首次 boot 即从损坏主键启动、直接走 fork 路径。
2. **前缀过滤误含索引键**：`archiveKeys` 过滤 `startsWith('bxstore:boxingLayout.corrupt.')` 把轻量索引键 `boxingLayout.corrupt.index` 也匹配进来，取 last 时拿到索引数组（`.raw` undefined → 第二次红）。修复：排除 `.index` 结尾键。

### 绿跑证据（验收项 5，全文件原始输出）

```
Running 5 tests using 2 workers
  5 passed (20.6s)
```
单用例（fork）：`[chromium-extension] › test\tests\data-recovery.spec.ts:256:3 › ... Corrupt main key is archived (fork) and app still boots — 1 passed (9.9s)`。断言覆盖：归档键存在且 raw 可读（verbatim 损坏载荷）、corrupt.index 更新、主键重建（boxes 为数组）、pageErrors==[]、#canvas/#canvas-surface attached。

### 门禁

- node --check storage.js/utils.js：绿；git diff --check：干净。
- import-graph-guard：本票 **0 新违规**（14 modules / 48 edges 不变）；当前 CM-1 报 `boxing-probe-42r.spec.ts` 未登记 cluster——红源为并行票 42R 的 untracked probe 文件，非本票改动面，本票不代改（WORKFLOW：不动其他票文件）。
- 本轮绿跑为本地实跑（43R 任务书明确要求"先重跑基线/贴 passed 行"，覆盖 43 票的 CI-only 待跑状态）；issue 勾选以本轮实跑为证据。

### 状态同步

- issues/43：Status ready-for-agent → **done**，4 验收项勾选（V5-43-1 矛盾消除）。
- issues/43R：8 验收项全部勾选，Status → **done**。

