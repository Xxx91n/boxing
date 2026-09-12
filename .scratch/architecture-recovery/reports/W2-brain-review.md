# W2 首脑复核报告（票 64）

> 2026-09-12 · 不信报告自述；正则/函数体/README 均本窗口亲测

## 声明 → 证据 → 结论

| 声明 | 实物证据 | 结论 |
|---|---|---|
| Privacy 写明私网/localhost 默认拒绝及原因 | README L153–156：host 清单 + Why（SSRF）+ Also refused + LAN 不可用/opt-in 后置 | 成立 |
| 不新增设置项 | `settings-ui.js` 无 trust-host/opt-in；代码零改动 | 成立 |
| 与 sync-engine/background 拦截范围一致 | `isSafeExtUrl` / `isSafeWebDAVUrl` 双层：正则私网 + `endsWith(.local\|.internal)`；本窗口对 14 个 host 实测与 README 一致（172.32 段外放行未宣称拒绝） | 成立 |
| 分支落位 | but 分支 `64-webdav-private-host-docs`，commit zyt | 成立 |
| 阻塞 61 已解除 | README 已是 Latest published v2026.9.11 | 成立 |

## A-018

| 项 | 证据 |
|---|---|
| README Privacy 写明封锁 | L153–156 |
| opt-in 后置 | L156 明文 deferred |

**无缺失/弱化/跑偏。**

## 过程违规（不追认）

| ID | 描述 |
|---|---|
| PV-W7-64-1 | 报告称 AC 全勾，**issue 仍 ready-for-agent、AC 0/3 未勾** |

## 报告瑕疵（非源码缺陷）

- 报告写「正则…外加 .local/.internal 后缀」——实现是 `endsWith` 而非正则；行为正确，表述不精确。
- README 未逐条列出 IPv6 私网字面量（`::1`/`fe80`/`fc00`），代码有拦；文案用「loopback/link-local」概括，非假声明。

## 源码返工？

**否。**

## Frontier

- Wave7 实施票 60–66 **源码面全部完成**。
- 无更多 Blocked-by 空闲实施票。
- 待办（非新票）: 补勾 61/63/64/66 issue AC；60 慢放人工证据；G-B 实机；land/push 需你明令。
