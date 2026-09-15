# 调研任务：浏览器扩展仓库 CalVer 版本面一致性推进的工业成熟方案

## 背景（已发生事实，不要重复推导）

- Chrome MV3 + Firefox 浏览器扩展仓库（单仓、无框架、无打包器、零运行时依赖），版本号用 CalVer `YYYY.M.D` 非零填充（2026.9.20；前导零同时违反 Chrome Web Store / AMO / npm semver 三方约束）。
- 版本面分散在多处：`manifest.json` 的 `version`+`version_name`、`package.json` + `package-lock.json`（两处）、`ntp/index.html` 静态脚注 `Boxing v<ver>`、`CHANGELOG.md` 的 `## [<ver>]` 小节、`docs/release-notes/<ver>.md`（CI 以它作 GitHub Release body_path）、发行指南/上架计划等文档。
- 已有零依赖 Node 门禁 `scripts/calver-guard.mjs` 串在 `npm test` 的 pretest 链：校验上述各面一致 + 单调性（不得低于已发行最高 git tag）+ 13 例自检（2 正 11 反）。
- 仓库无 npm 运行时依赖、不引入新依赖；release tag/商店上传由用户人工执行。

## 需要你回答（每问给「推荐 + 理由 + 可核验来源」）

1. 工业界如何管理「一次发行要同步改 N 个文件里的版本号」？对比真实做法：(a) 单事实源+构建期注入（如 manifest 由模板生成、版本号从 git tag 派生）；(b) 发行自动化工具（release-please、changesets、semantic-release、standard-version、cargo-release 的跨文件 bump 机制）；(c) 人工多文件修改 + CI 一致性门禁兜底。各自的失败模式与适用边界是什么？对「无构建管线、manifest.json 直接进 zip」的 MV3 扩展哪种最合适？

2. CalVer（YYYY.M.D 非零填充）在浏览器扩展/应用发行中的采用情况与版本排序语义：谁在用（如 Ubuntu、pip、Firefox 的 train 编号、VS Code 月份版）、与 semver 工具链的兼容坑（npm 对 `2026.9.20` 的解析、sort -V / semver compare）、单调性与回退约束的工程实现（git tag 作为已发行事实源 vs 文件记录）。

3. 「版本面一致性门禁」的成熟形态：检查项设计（哪些面必须全等、哪些只需提示）、自检/变异测试（故意改一面应必红）惯例、接入点选择（pretest vs pre-commit vs CI 显式步骤）、以及「发行 notes 文件存在性作为硬依赖」是否有先例。

## 输出要求

- 中文；按 3 问分节，每节先结论后论证；给出来源（项目/文档名 + 发布方 + 年份或可定位 URL）。
- 无法核验的写成「信息缺口」，不得编造。
- 最后给「对本仓库的具体建议」一节：① 现有人工 bump + calver-guard 形态是否已达工业水位，还缺什么；② 是否值得引入 release-please/changesets 类工具（注意零依赖约束）；③ release-notes/CHANGELOG 双写防漂移的最低成本做法。
