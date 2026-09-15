# 108: 静态门禁：layout 旁路不得绕过 mutationHandlers

**Covers A-xxx:** A-063

**What to build:** pretest/test.yml 能拦下 layout 集合在 handlers 外的删除/改写调用。

**Blocked by:** 107

**Status:** done（2026-09-15 · ticket 108）

## Acceptance criteria

- [x] 扫描 ntp/** 删除类调用 — `scripts/layout-bypass-guard.mjs` LB-1（splice / pop / shift / unshift）on `layout.boxes`/`layout.connections`/`layout.groups`/`layout._meta.deleted`/`state.boxes`/`state.connections`/`<ident>.children`/`<ident>.bookmarks` + 文件内别名（4 轮不动点）；扫描 15 模块 / 8541 行
- [x] 白名单注释豁免具名 — 语法 `// layout-bypass-allow: <name> - <reason>`（同行或紧邻上一行）；name 必填且须匹配 `[a-z0-9][a-z0-9._-]*`，reason >= 12 字符；**无模块级一把梭豁免**；**LB-3 孤儿豁免即红**；每次运行打印活豁免清单（当前 9 条）
- [x] 故意旁路 exit 1 — `--self-test` **18/18 PASS**（书签删除旁路 / 别名旁路 / 墓碑删除 / 成员改写 / 索引赋值 / `Object.assign` / `length=0` / 无名豁免不生效 / 孤儿豁免红 / 标记缺失 fail-closed）
- [x] 接入 pretest 或 test.yml 并记录 lane — `package.json` pretest 链**第 2 位**（八门）+ `.github/workflows/test.yml` 显式步骤 `Layout bypass guard (ticket 108 / A-063)`；**lane = 主 lane `test` job（三 OS）的 pretest 链 + 显式步骤**

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 报告: reports/108-report.md

## 处置结论（2026-09-15）

- **AC 全勾**（上方四项），无 F 项。
- **完成门**：`npm run pretest` 八门全绿（exit 0）；全量 e2e **639 passed / 5 skipped / 0 failed**。
- **唯一真实删除类旁路已收编**：`ntp/popups.js` 书签拖拽重排 → `mutationHandlers.reorderBookmarks` + `commit(..., { save: true })`（D-002④ 裁定；add 类具名 N-108-01 不同票）。
- **109R**：`test/cluster-map.json` 补 `boxing-pages-gc-version.spec.ts` → `node scripts/import-graph-guard.mjs` exit 0。
- **113R**：`docs/release-status.md` 商店 published 对齐 **2026.9.15** → `node scripts/locale-readme-guard.mjs` exit 0（**guard 基线未改**，`--self-test` 仍 PASS）。
- 具名残留/建议：**N-108-01**（add 类 `push` 未走 handler）· **N-108-02**（模块边界/零活豁免，调研方案 c）· **N-108-03**（别名逃逸能力边界，建议 dev 冻结兜底）· **N-108-04**（calver 对 publishing-guide 的非阻断告警，票 116 面）· **N-108-05**（他人窗口 `git diff --check` 存量告警）· **N-108-06**（`release-status.md` 目标发行版本仍为 2026.9.15，需状态页刷新票）。
- 版本控制遵循 WORKFLOW §4.2；未 push / 未开 PR / 未 tag。
