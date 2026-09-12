# 76 — G-B Chromium dry-run 预检产物（**非 G-B 证据**）

> 本目录是**演练（rehearsal）产物**，不是 G-B 证据。
> A-009（decision-ledger）+ ADR-0017：G-B 必须由**人**在真 Chrome 与 Firefox 上执行；
> 本目录任何全绿结果都**不得**被表述为「G-B 通过」或用于放行 tag。
> 与正式证据目录 `evidence/49-g-b-manual-golden-path/` 物理隔离，即为避免误认。

## 用途

在真人执行 G1–G6 之前，用脚本把执行卡里**可机械化的步骤**先跑一遍：
证明步骤可复现、提前暴露卡里写错或跑不通的命令，缩短真人执行时间、降低返工。

## 复跑

```
node scripts/gb-dryrun-chrome.mjs                                  # 默认 D:/rel-2026.9.12/chrome
node scripts/gb-dryrun-chrome.mjs --ext=<新候选解包目录>            # 出新包后零成本重跑
node scripts/gb-dryrun-chrome.mjs --out=<输出目录>
```

不触发任何 build / 签名 / release。仅读取磁盘上已存在的解包产物。

## 产物

| 文件 | 内容 |
|---|---|
| `summary.json` | 12 项检查的结构化结果 + 判定 + 越界清单 |
| `storage-dump.json` | 真实 `chrome.storage.local` 键一览、snap 索引、layout 形态 |
| `layout-dump.json` | 播种后的布局对象 |
| `console-errors.txt` | 页面 console error / pageerror 采集 |

## 覆盖边界

- **已机械化**：产物装载、扩展源与门面断言、console 采集、引导走通、建盒/持久化/重载往返、存储 dump、v2 单程规范化（G5b）。
- **仍须人工**：G3（旧备份需上一发行版真实导出）、G4（自 v2026.9.11 升级 + pre-update 快照）、G6（具名确认人）、**整个 Firefox 车道**（Playwright 无法在未签名下装载解包扩展）、SW console（无 Playwright 事件面）。

## 时效

本目录结果只对 `summary.json` 里 `artifact` 指向的那个解包产物成立。
源码一改（票 71/72/73、79–83）即需出新候选包并重跑；届时本目录结果作废（不追认）。
