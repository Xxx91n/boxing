# 窗口启动器 — 08 version-unify (版本字符串统一 + version_name 注入) [Wave2 后 frontier 重发]

身份: Boxing 子窗口实施代理, 只做本票, 不跨票。

## 背景 (首脑复核)

Wave2 复核: 01/02/03 已 DONE, 本票阻塞边全解除, 为唯一 frontier。
残留: manifest/package 仍 2026.9.9; 页脚可能 v3.6.6; build.mjs 可能不覆盖 version_name。
复核报告: .scratch/architecture-recovery/reports/41-wave2-brain-review.md

## 必读 (动手前全部读完)

- .scratch/architecture-recovery/handoffs/08-version-unify.md
- .scratch/architecture-recovery/issues/08-version-unify.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md (仅 §4.2 / §4.3)
- AGENTS.md
- docs/CONTEXT.md
- 38-2026-09-12-release-architecture-investigation.md §2 版本清单
- reports/41-wave2-brain-review.md

## 阻塞

已解除: 01 icons DONE · 02 readme-sync DONE · 03 store-i18n DONE

## 本票 delta

路径锚点: manifest.json, package.json, README.md 徽章, CHANGELOG.md, AGENTS.md, ntp/index.html 页脚, .github/scripts/build.mjs。
1. 全部版本字符串 → 2026.9.12 (manifest version+version_name, package.json, README 徽章, CHANGELOG 新节, AGENTS.md, settings 页脚)。
2. 修复 build.mjs: BOXING_BUILD_VERSION 同时覆盖 version 与 version_name。
3. settings 页脚不得再显示 v3.6.6 (从 manifest 注入或写死 2026.9.12)。
4. 03 已把 name/description 改为 __MSG_ — 勿回退; 只动 version 字段。
5. 02 已改 Install 文案 — 勿回退; 只动版本徽章数字。

## 硬约束

- 版本控制表述只写「遵循 WORKFLOW §4.2」, 禁止在本文件或回复中出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 不改写他人提交; 不动其他票文件。
- 分支并行: 与 01-07 各分支互不影响, 只写本票文件。

## 开工第一句 (必须先输出)

1. 复述阻塞状态: 已解除 (01+02+03 DONE)
2. 复述必读清单 (逐条路径)
3. 复述复核结论 (本票 FRONTIER) 后再读文件/改代码

## 质检要求

提交前先自检一次复核主 Agent 的检查结果再执行:
- node 读 manifest.json (version/version_name=2026.9.12, name/desc 仍 __MSG_) + package.json version === 2026.9.12
- grep README 徽章、CHANGELOG、AGENTS.md、ntp/index.html 页脚无 2026.9.9 / v3.6.6 残留
- grep build.mjs 确认 version_name 覆盖逻辑存在

## 完成时

- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/08-version-unify-report.md
- 报告须含: 版本字符串前后对照表、build.mjs version_name 覆盖证据、页脚修复证据
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
