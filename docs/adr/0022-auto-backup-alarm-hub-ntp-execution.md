# ADR-0022: 自动备份 = SW 闹钟枢纽 + NTP 执行 + 补跑检查

## Date
2026-10-15

## Status
Accepted - wave 2026.10.16 grill 决策 D-002（atomcode 调研 floccus 等成熟实现交叉印证）

## Context

自动备份自 ADR-0009 引入 `chrome.alarms` 后从未真正生效。实证根因链：

1. `chrome.alarms.onAlarm` 监听器注册在 NTP 页上下文（`ntp/sync-engine.js`）——alarms 事件是全局广播但页面关了监听就死，与注释声称的 "survives NTP page close" 相反；
2. `background.js` 的 SW 监听器只向**开着的**扩展页 `sendMessage`，无人接即静默丢弃，代码注释谎称 "deferred" 但实际无任何补跑机制；
3. 去重用的 `lastAutoBackupTs` 是模块级变量不持久，跨会话形同虚设；
4. `performBackup`/`backupToGist` 直接读 DOM 输入（`gistTokenInput.value`）与页面 `layout` 状态，SW 上下文根本拿不到凭据。

调研结论（atomcode，交叉 floccus/Chrome 官方/chromium-extensions）：闹钟全局广播但只有 SW 能被唤醒；页面上下文监听不可靠；Firefox 不跨会话持久闹钟 → 每次启动必须幂等 ensure；业界成熟模式是备份在 SW 一处跑（floccus Controller 全委托 worker）。但 SW 化需要把凭据解密链路搬进 classic-script SW（不能 import ESM，dual-manifest 地雷），工程量大。

## Decision

采用 **NTP 执行业务 + SW 闹钟枢纽**（选项 B），不采用 floccus 式全 SW 化（选项 A，连同标题迁 input 一并 deferred 至 roadmap issue #25 的专属大重构轮）：

- alarm 由 NTP init 幂等创建/确保存在（顺带修复 Firefox 闹钟不跨会话持久）；
- SW 顶层 `onAlarm` 保留，触发时写 `storage.local.autoBackupDue` 标记 + 照旧向开着的扩展页发消息；
- NTP init 检查 due 标记或持久化 `settings.lastBackupAt` 过期 → 立即跑 `performBackup` 并清标记；
- 删除 NTP 页重复的 `onAlarm` 监听（防双跑）；废 `lastAutoBackupTs`，去重改用持久 `lastBackupAt`。

否决理由：选项 A（SW 全权）要求把凭据解密与 `performBackup` 移植进 classic-script SW（无 ESM import、凭据 per-install key 端口重建、Firefox dual-manifest 路径），改动面与回归风险远超本波；"关浏览器也按时备份"本来就不是可达语义（无浏览器即无网络动作），B 的 due-flag 补跑已覆盖 SW 化剩余价值的绝大部分。

## Consequences

- 正面: 自动备份首次具备真实可达语义——开着按时跑、错过下次开 NTP 立即补；凭据/DOM 依赖链零改动；Firefox 闹钟不持久被幂等 ensure 吸收。
- 负面/妥协: 备份仍只在 NTP 打开时执行——"浏览器开着但无 NTP 页"的窗口靠 due-flag 推迟，不丢但会延后；语义上限是"下次开新标签页补齐"，对每小时级间隔可接受。
- 中性/约束: `onAlarm` 监听只许存在于 SW（顶层同步注册），页面上下文禁止再注册同名 alarm 监听；`lastBackupAt` 成为唯一去重权威；未来若迁移全 SW 化（#25）须连凭据解密一并搬。

## Review

- 复核日期: 2026-11-14
- 复核项: autoBackupDue 补跑在真实使用中是否按预期触发；是否存在"开着 NTP 但备份仍漏"的残余 case；#25 大重构轮启动时本 ADR 是否被 Supersede。
- 复核结论: <待回填>
