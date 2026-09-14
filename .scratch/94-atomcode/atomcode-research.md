# atomcode-94 调研蒸馏 — 版本面同步 × 发行说明 SSOT × 门禁重跑

> 原始输出已索引至 ctx FTS5（source=`atomcode-94`，12 sections）；本文件为落盘蒸馏（票93 同款格式）。Confidence: 高（多引擎 + 官方×2/工程博客×3/生态×2 交叉验证）。

## TL;DR

1. **版本面不止 manifest**：成熟项目至少同步 6 面 — `manifest.json.version`、`package.json`、`CHANGELOG.md`、git tag、GitHub Release、商店 listing「版本说明」。SSOT 成熟做法 = CHANGELOG/release-notes 为唯一事实源，其余面由同一工具原子推进或从其摘取。
2. **版本号单调递增是平台铁律**：CWS 拒绝未递增上传（同版本重传会静默压制已装用户自动更新）；AMO 同规。成熟做法 = pre-commit + CI 双层递增校验，不靠人记。
3. **门禁必须绑新版本号重跑**：① CI 绿跑的对象是「待发布构建产物」（release PR / 合并后确切构建），不是 main 中间态；② 人工验收测 CI 产出的同一 zip，禁止本地重新打包，版本号即制品对账锚点；③ 页面存活在发布事件后重跑，机械化定义 = `version.json` / 渲染版本号 == 新 tag（非仅 200）。**任何门禁失败 → 修复 → bump 到更新版本号 → 三门全部重跑**；版本号天然是重跑轮次计数器，禁止「同版本号只重跑失败门禁」。

## 对本票的落点

- Boxing 走 **形态 C（CalVer + 手写 CHANGELOG + CI 一致性校验）**——release-please 对 CalVer 不友好；本仓票08 已是此路线（manifest+package+lock+index.html 兜底+AGENTS+CHANGELOG 六面清单），本票沿用并新增 `docs/release-notes/2026.9.15.md`（build.yml `body_path` 硬依赖 = 仓库内 Release notes SSOT）。
- **门禁重跑映射到 ADR-0017**：G-A = 对新 tip 的 test.yml 全绿（前波证据 run 34773593267/34778641702 对 `02d31657` 有效，但 9.15 bump 落 main 后须重跑或论证 tip 等价性——test.yml `on.push.paths` 决定版本面改动是否触发）；G-B = 用户对 9.15 zip 的声明 pass（版本号+日期，禁 agent 代签）；G-C = 发布事件后三 URL 200 + demo 渲染版本 == v2026.9.15。
- 已知坑复核：`on: release` 的 GITHUB_TOKEN 事件不触发后续 workflow——本仓 demo-deploy.yml 确用 `release: published`，publishing-guide Part 5 已留手动重部口径（`gh workflow run demo-deploy.yml`），与调研结论一致，无需改向。

## 来源清单（atomcode 报告原文）

| # | 来源 | 角度 | 贡献 |
|---|---|---|---|
| 1 | developer.chrome.com/docs/webstore/update | 官方 | 版本递增硬规则；deferred publish；partial rollout |
| 2 | developer.chrome.com/docs/webstore/review-process | 官方 | 审核时长；宽权限拉长审核 |
| 3 | anishgandhi.com/chrome-extension-version-bump-precommit-ci/ | 对比 | pre-commit+CI 双层递增门禁 |
| 4 | zenn.dev release-please 实操 | 对比 | extra-files 同步 manifest；缺配→商店报 Invalid version；GITHUB_TOKEN 事件陷阱；审核期重传取消 |
| 5 | extensionworkshop.com signing-and-distribution | 官方 | AMO listed/unlisted 签署矩阵；24h 签发或转人工 |
| 6 | github.com/googleapis/release-please | 官方 | Release PR 生命周期；CHANGELOG/tag/Release 一体生成 |
| 7 | jam.dev automating-chrome-extension-publishing | 社区 | 半自动：CI 传草稿 + 人工对账版本号 + Submit |
| 8 | extension.js.org Playwright E2E | 官方 | `headless:false` 硬要求；ready.json 门禁契约 |
| 9–11 | git-lfs #4210 / pip-licenses #272 / docs.github.com auto-release-notes / Thinking-Claude release | 社区/官方 | SSOT 痛点佐证；双版本面 sync check 实例；形态 B 官方机制（检索命中级，未全文） |
