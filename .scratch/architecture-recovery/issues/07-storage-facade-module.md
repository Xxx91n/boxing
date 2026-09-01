# 07 — storage 写入门面单模块

**What to build:** storageWriteChain 串行写链 + applyingExternalLayout 防回环 + storage.onChanged 监听注册 收敛为一个 storage 门面模块。整个代码库的所有 storage 写入只经此门面; 门面内部保持写链串行化不变。存储区选型不动 (storage.local, ADR A6)。

**Blocked by:** 03, 06

**Status:** done (2026-09-01, ticket 07 agent)

- [x] 唯一的 storage 写入门面模块存在, 其余模块只调用其方法 — ntp/storage.js (366 行) 是 NTP 侧唯一 chrome.storage 写入点: 12 导出 (saveLayout/saveLayoutDebounced 写链 + directSetBoxingLayout 显式 direct 类 + applyExternalLayout 防回环 + registerStorageOnChanged + load/saveSnapshot/merge 家族 + initStorageFacade 注入)。ntp.js 0 处直接 layoutStorage.set; background.js 仅 bgErrLog (独立 worker 上下文, 不属 boxingLayout 写路径)
- [x] 写链串行化与防回环标志逻辑原样保留在门面内, 未被拆散 — storageWriteChain 链式写 + applyingExternalLayout 置位/复位 + onChanged 注册三件套整块逐字节搬移 (origin L543-673 / L3565-3644 / L5316-5320), 搬移脚本断言 blockD verbatim 嵌入 + export 前缀为唯一差异; SEC-08 debounced/direct 调用点分类原样 (79 saveLayout 调用点不改)
- [x] 两个标签页同时操作不回环、不丢写 — 双标签脚本验证 9/9 PASS (真 chrome.storage.onChanged): A→B 19ms 传播 / B→A 双箱保留 / 并发写收敛为 4 箱并集 / revision 6→6 静止无回环 / writerId 自写拒绝; 另 file:// 车道 boxing-state-sync 全绿
- [x] `npm test` 419 passed (6.0m, 复跑确证; 首轮 firefox accent-theme 3 项为车道抖动) + `npm run build` DONE_BUILD (dist 双树 ntp/storage.js 各 1) + node --check 双绿 + ESM 冒烟 12 导出平价


---

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: ntp/storage.js (366 行) = 写链三件套 (saveLayout+storageWriteChain / applyingExternalLayout / registerStorageOnChanged) + mergeConcurrentLayout (按票05 纯度清单认领) + load/saveSnapshot/crashRescue 家族 + stripGroupsForPersist/gcTombstones/markDeleted/TOMBSTONE_TTL_MS; ntp.js 5442→5160 行, 头部 import 门面 12 绑定 + initStorageFacade 注入 18 个 ntp.js 作用域依赖 (log 三件套 + 渲染管线), WebDAV 4 处 direct write 经 directSetBoxingLayout (注释与 try/catch 原样)。
2. **结构决策**: 跨作用域函数用 "模块级 let + initStorageFacade 一次性注入" 而非参数传透 — 搬移块内部零字节改动 (WORKFLOW §6 byte-exact), 注入发生在 init() 最前 (layoutStorage 赋值行后), 早于任何门面调用。state.js 单例继续被门面 import (票06 契约: 门面是 chain/flag/debounce 三状态唯一写者)。
3. **验证证据**: 搬移脚本 10 层自验全过 (边界 19 断言 / census 27 符号 / blank-run 守恒 / verbatim 嵌入 / node --check / ESM 冒烟), 首两轮回滚 (L5441 边界笔误 + 行数算术), 第三轮落盘; npm test 419 passed; 双标签 9/9; git diff --check 干净。
4. **版本控制 (§4.2)**: branch `arch-recovery-07-storage` (anchor arch-recovery-04-i18n 之上, 栈顶), commit `nmt` (feat)。首次提交被拒 (ntp.js 行依赖 05/06), 按多依赖场景 anchor 到含全链的栈顶 04 后落位。未 push。
5. **给 08 的接口提示**: loadLayout/saveLayout/saveLayoutDebounced/applyExternalLayout/saveSnapshot/markDeleted/gcTombstones/stripGroupsForPersist/directSetBoxingLayout 已从 storage.js export; 渲染管线 (renderCanvas 系) 仍在 ntp.js, 票08 拆渲染时注意 initStorageFacade 注入表需同步更新 (renderCanvas 等若迁出 ntp.js, 注入引用跟着改)。
