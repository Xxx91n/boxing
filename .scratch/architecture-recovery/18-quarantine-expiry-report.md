# 18 — Quarantine expiry decision · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-04 (收口; 基线与探针捕获于 09-03 深夜)
- 状态: **done** — handoff 完成定义 4/4 满足; issues/18 验收 5/5 勾 + 决议写回
- 分支: `arch-recovery-18-quarantine-expiry` (GitButler, WORKFLOW §4.2, 未 push), commit `sqz`
- 上游依据: prompts/18 + handoffs/18 + issues/18 + spec.md + WORKFLOW.md + round3-architecture-report.md + README.md + 两个 playwright config (必读 8/8 全读)

## 完成定义勾稽 (handoff)

| 验收项 | 证据 |
|---|---|
| Fresh quarantine-lane baseline is recorded | 38 运行 (19 tag × 2 project): chromium **19/19 绿**; firefox **18 失败** (远差于 09-02 台账的 5)。三轮收敛: workers=2 重跑 11 失败/7 绿 → workers=1 solo 10 绿/1 失败。全文见"基线与三轮收敛" |
| Each of the five Firefox failures is repaired or retired and the choice is recorded | **5/5 repair, 0 retire**; 逐项依据见"逐项决议"; 决议同步写回 issues/18 验收勾稽节 |
| The README quarantine table and ledger no longer contain stale failure rows | README 表 19→14 行, 0 个 **fail** 行 (grep 验证), 基线句子改 2026-09-03; 21 处 quarantine-ref 注释路径刷新到归档位置 |
| Closure report exists at .../18-quarantine-expiry-report.md | 本文件 |

## 基线与三轮收敛 (环境噪声 vs 持久失败的判别)

新鲜基线 (workers=4, 全 38): firefox 18 失败, 签名全部环境类 — page.goto 30s 超时 / 原生输入 (click/dblclick/move/wheel) 停滞到测试结束 / juggler teardown 挂。与 WORKFLOW §6 三条既有教训同族: 票01 (workers 饿死 8 个有头浏览器 → workers:4), 票13 (firefox 有头冷启动 ~22s 耗尽默认预算), 票15 (满负载 firefox 车道整批假失败 → last-failed 收敛 + 残余 solo 终验)。宿主另有 explorerpatcher.amd64.dll 被 Firefox blocklist 拦载 (环境噪声源之一, 非仓库问题)。

- **R1** workers=4 → 18 fail; **R2** last-failed workers=2 → 11 fail / 7 绿; **R3** last-failed workers=1 (solo) → 10 绿 / 1 fail。
- R3 唯一确定性失败 = **audit saveLayout 回退** — 错误稳定在 `expect(fb && fb.length).toBeTruthy() — Received: null` (boxing-audit.spec.ts:86), 与负载无关, 进探针诊断。
- 其余 10 项 solo 全绿 → 判为冷启动/负载噪声; 但其中 3 项 (debug / innerclip y=0 / popup-dragselect) 在后续多轮验证中反复以不同签名抖动 (input 停滞 / close 挂 / 零尺寸隐形窗口 / 预算耗尽), 且台账明确其隔离原因是原生输入 (票01 教训), 故不满足"摘标前连跑几轮确认稳定"而不加治理 — 按票14 收口建议做了输入剥离 (见决议 3/4/5)。

## 逐项决议 (5/5 repair, 0 retire)

### 1. adr-0007-acceptance › Q3b spatial index threshold 32 — repair 摘标
纯 page.evaluate 测试 (无原生输入), 断言 SPATIAL_THRESHOLD=32/buildSpatialGrid/querySpatialNearby。firefox 三轮独立绿 (R2/R3/主车道)。09-02 与今日失败均为 goto 冷启动噪声。行动: 摘 @quarantine + 删 ref 注释 → 回 firefox 主车道。

### 2. boxing-audit › saveLayout localStorage fallback — repair 摘标 + 测试补丁手法修正
R3 solo 确定性失败。**双探针定谳** (探针A/B, 已删): 测试用 `(ls as any).setItem = fn` 猴子补丁制造 quota 抛错, Firefox 上该补丁根本不生效 — `hasOwnProperty('setItem')=false`, 补丁后写入仍成功 (patchWorks=false); `Object.defineProperty` 实例级同样无效; **`Storage.prototype.setItem` 原型补丁双引擎生效**。即: Firefox 从未抛 quota 错 → saveLayout 正常走 storage.set → 无回退快照/无 __lastSaveError → 断言 null 失败。**产品回退链完好** (ntp/storage.js saveLayout catch → boxingLayoutFallback.v1 + __lastSaveError, mock.set 重抛已核实), chromium 绿是因为 chromium 尊重实例遮蔽。
修复 (测试侧, 11 行): 改用 Storage.prototype.setItem 补丁 + 挂 `__boxingRestoreSetItem` 还原钩子, setWebDAVConfig 触发写链后立即还原; 测试意图 (BX-AUD-04 回退行为) 不变。行动: 摘标。

### 3. boxing-debug › open NTP via file:// full workflow — repair 摘标 + 车道加固
12 步全流程 file:// 冒烟。多轮抖动签名: goto 停滞 / `.click()` 停滞 / `context.close()` 超时 (12 步全绿后!) / `#app` 不可见 (manual newContext 产出零尺寸窗口) / 44s 超预算。全部指向 manual `browser.newContext()` + 原生输入管线在有头 firefox 的脆弱 (juggler), 无一指向被测应用逻辑 — 12 步断言在任何一轮都未失败过。
修复 (测试侧): (a) 原生点击/双击 → 合成派发 jsClick/jsDblclick (套件既有模式); (b) manual newContext → 套件标准 fixture page + boot (清 storage + reload + poll __boxingDebug, 与同套件其他 spec 一致); (c) setTimeout 40s→90s (实测 44s 全步绿)。行动: 摘标。

### 4. boxing-innerclip › small-box at y=0 across zoom — repair 摘标 + 删残余原生调用
缩放本就由合成 WheelEvent 驱动 (自带 clientX/clientY + ctrlKey), 其前的 mouse.move + mouse.wheel(含16参怪调用) 是死重且是停滞源 (R4 主车道验证中 mouse.move 30s 停滞一次)。同文件两个主车道主测试同构 (同 boot, 纯 evaluate+合成)。修复: 删两处原生调用 + 注释说明。行动: 摘标。

### 5. boxing-popup-dragselect › popup stays open after drag-select — repair 摘标 + 合成指针序列
被测行为是 BX-DEV-127 关闭守卫: **只看 mousedown 起点** (document-capture listener, popups.js:243-253/359-367, 读源码确认), 不依赖事件 isTrusted。修复: 原生 dblclick/click → 合成 (与 innerclip 同款); 原生 mouse down/move/up 拖选 → 合成 pointer/mouse 事件序列 (pointerdown 落在输入框内 → 6 步 move 越过弹窗边缘 → pointerup 在弹窗外)。守卫决策被同一形态的输入锻炼, 意图不变。行动: 摘标。

### 不退役任何一项的理由 (统一记录)
三项原生输入测试 (3/4/5) 的目的是应用行为流而非输入真实性; 输入真实性本身即目的是 focus-steal 系列 (不在本票 5 项内, 不越权处置)。删除会把 chromium 主车道正在提供的回归覆盖一并删掉。修复路径 = 剥离原生输入依赖 (playwright#16095 类停滞的来源), 保留被测行为 — 对应 spec.md "repair by removing the quarantine tag" 与票14 收口建议第 2 条。

## 残余 14 项隔离面 (未处置, 保持排除)

focus-steal×3 / innerclip-pan / onboarding / v3×3 / webdav×4 / data-recovery / extension-test 全部 pass/pass (README 表一致)。它们的隔离原因是 playwright#16095 原生输入挂起, 本机今日满负载复跑 firefox 侧仍见 input 停滞, 不满足票14 "摘标前先连跑几轮确认稳定" 的门槛 — 保持 @quarantine。这是**治理决策**: 本票范围是 5 个失败项的到期裁决, 不扩围到"把绿的也摘掉"。

## 引用完整性 (票09 教训: 收尾三件套)

issues/14 已随 round2 归档至 `.scratch/archive/2026-09-architecture-recovery-round2/`, 全仓 21 处 `quarantine-ref` 注释 (19 test + 2 config) + README 1 处正文链接路径同步刷新为归档路径, grep 验证 0 处残留旧路径。issues/18 已写回 Status: done + 5/5 勾 + 逐项决议。

## 车道验证证据 (时间序)

1. R1 全 38 (workers=4): chromium 19/19 绿。
2. R2 last-failed firefox workers=2: 7/18 绿。
3. R3 last-failed firefox workers=1: 10/11 绿 (audit 唯一确定性败)。
4. audit 探针A/B (firefox solo): 补丁失效机制定谳。
5. 修复后五 spec quarantine 车道 firefox workers=1: 5/5 绿 (44s)。
6. 修复后五 spec quarantine 车道 chromium workers=1: 15/15 绿。
7. 修复后五 spec **主 config firefox 车道** workers=2: 15/15 绿 (中途 debug 一次 budget 超限 → 90s 修复后绿)。
8. 全量 `npm test` (主 config, workers=4): **420 passed**, 13 个 firefox 假失败 (accent-theme×5/adr×5/audit×2/auto-expand/conn×2 — 全环境签名)。
9. last-failed workers=2 收敛: 420 绿 / 4 fail (accent-theme×2/empty-state/innerclip 主项)。
10. last-failed solo: **4/4 绿** (44.7s) — 按票15协议 "两轮内收口 + 残余 solo 终验" 完成, §4.1 清绿门禁满足。
11. `git diff --check` clean (LF 红线); node --check 对改动 spec 语法由 playwright TS 转译隐式验证 (全部编译执行)。

## 版本控制轨迹 (§4.2)

- GitButler 独立分支 `arch-recovery-18-quarantine-expiry`, commit `sqz`: 19 文件 = 12 spec + 2 config + README + issues/18 + prompts/18 + handoffs/18 (后两者为本票任务书, 票14 连同提交先例) + 本报告。工作区混有大脑窗 round3 工件与并行窗票17新收口报告 (`17-documentation-consistency-sync-report.md`) — **全部排除在外, 不卷入** (票05 hunk 认领纪律)。
- 未 push, 未开 PR (§4.2)。
- dev-chrome junction 删除状态为既有环境差异, 非本票产物, 未纳入。

## 给大脑的收口注意

1. **残余 14 项到期即裁决**: 2026-10-02 同日到期; 今日满负载下 firefox input 停滞仍在 (原生输入语境未变), 到期裁决时"退役默认"可能真会落地 — 建议下轮治理票先评估 webdav/v3/data-recovery/extension-test 的合成化可行性 (本票 innerclip/dragselect/debug 的合成化模式可直接复用), focus-steal 系列输入真实性即目的, 建议优先退役评估。
2. **@quarantine 计数合同**: 主 config grepInvert 与 quarantine 车道 --grep 的配比随 19→14 变化, 两 config 注释已同步 (计数描述在注释里保留 "chromium fixed all 30" 历史语义, 未改)。
3. **probe 文件卫生**: 3 个临时探针 spec 全部即建即删, test-results/ 的 debug-*.png 截图是 boxing-debug 测试自身产物, 留待 CI 清理。
4. **无偏离**: 必读 8/8; 基线先行; 逐项决议含依据; 表格与台账一致; GitButler-only。
