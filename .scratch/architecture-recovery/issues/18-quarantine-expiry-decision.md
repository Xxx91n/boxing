# 18 — Quarantine expiry decision

**What to build:** Process the five Firefox quarantine failures by repairing or retiring each one before the due date, and make the governance table consistent with the outcome.

**Blocked by:** None — can start immediately

**Status:** done (2026-09-04)

- [x] Run the dedicated quarantine lane and capture a fresh baseline.
- [x] For each of the five Firefox failures, choose repair or retire and execute that choice.
- [x] Remove quarantine tags and ledger rows for repaired tests; delete retired tests and record the decision.
- [x] Update the public quarantine table so it matches the resulting lane.
- [x] Write the closure report named in the handoff.

## 验收勾稽 (ticket 18, 2026-09-04)

- 新鲜基线: `npm run test:quarantine` 全车道 38 运行 (19×2) — chromium 19/19 绿; firefox 18 失败 (远差于 09-02 台账的 5 失败), 失败签名全部为环境类 (goto 30s 超时 / 原生输入 click/dblclick/move 停滞 / juggler teardown 挂), 与 WORKFLOW §6 票01 (workers 饿死有头浏览器) / 票13 (firefox 冷启动 ~22s 耗尽预算) / 票15 (满负载 firefox 整批假失败) 教训同族。workers=2 重跑收敛到 11 失败; workers=1 solo 再收敛到 1 确定性失败 (audit)。
- 逐项决议 (5/5 repair, 0 retire — 依据见收口报告全文):
  1. **adr-0007 Q3b 空间索引** → repair 摘标。纯 evaluate 测试 (无原生输入), firefox 3 轮独立绿 (workers=2 / solo / 主车道), 09-02 与今日失败均为冷启动/负载噪声。
  2. **audit saveLayout 回退** → repair 摘标 + 测试补丁手法修正。solo 确定性复现后用双探针定谳: Firefox 忽略 localStorage 实例级方法遮蔽 (赋值与 defineProperty 均无效, patchOwn=false), 补丁从未生效故写入不抛错; 产品回退链 (storage.js saveLayout catch → boxingLayoutFallback.v1) 完好。改用 Storage.prototype.setItem 补丁 (双引擎生效) + 触发后立即还原。
  3. **debug file:// 全流程** → repair 摘标 + 车道加固。原生点击/双击换套件标准合成派发 (jsClick/jsDblclick); manual browser.newContext() 在有头 firefox 三种抖动 (启动挂 / close 挂 / 零尺寸隐形窗口) → 换套件通用 fixture page + boot 模式 (清 storage + reload + poll __boxingDebug); 预算 40s→90s (实测 44s 全步绿)。12 步断言从未失败过, 失败全在输入管线/生命周期/预算。
  4. **innerclip y=0 跨缩放** → repair 摘标 + 删残余原生调用。缩放本就由合成 WheelEvent (自带 clientX/clientY + ctrlKey) 驱动, mouse.move/mouse.wheel 是死重且是停滞源; 与同文件两个已在主车道的主测试同构。
  5. **popup-dragselect** → repair 摘标 + 合成指针序列。BX-DEV-127 守卫只看 mousedown 起点 (document-capture), 读守卫代码后确认合成 pointer/mouse 序列锻炼同一决策; 进盒/开弹窗同样合成化。
  - 不退役任何一项的理由: 三项原生输入测试的目的是应用行为流而非输入真实性 (输入真实性即目的的是 focus-steal 系列, 不在本票5项内且不在处置范围); 删除会把 chromium 主车道正在提供的真实回归覆盖一并删掉。修复方式 = 剥离原生输入依赖 (该依赖正是 playwright#16095 类环境停滞的来源), 保留被测行为。
- 标签面: @quarantine 19 → 14 (test 标签); quarantine-ref 21 处注释路径同步刷新 (issues/14 已归档至 .scratch/archive/2026-09-architecture-recovery-round2/), 含 README 与两个 config 注释块, 无悬空引用。
- 公开表格: README 隔离表 19 行 → 14 行 (5 个 fail 行删除), 基线句子改为 2026-09-03 (票18): 14/14 chromium + 14/14 firefox。
- 车道证明 (修复项): chromium 15/15 (quarantine config) + firefox 5/5 (quarantine config) + firefox 15/15 (主 config workers=2)。残余 14 tag 车道另行全跑验证。
- 版本控制: WORKFLOW §4.2, GitButler 独立分支, 不 push。