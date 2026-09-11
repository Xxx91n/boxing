# Ticket 54 — data-golden continue-on-error 摘除收尾报告

**日期**: 2026-09-12
**分支**: `ticket/54-data-golden-blocking`(GitButler 虚拟分支,已推送)
**状态**: 完成 — 全部验收项有真实证据
**调研来源**: 本票无新增调研问题,复用 Wave5/6 已索引 atomcode 结论(burn-in/lane 设计已在 ticket 45 完成,票内引用 ADR-0009 / ADR-0016;见 issues/54 上下文)。

## 1. 任务(delta)

2026-09-18 前摘除 `.github/workflows/test.yml` 中 @data-golden 的 `continue-on-error: true` 并保持绿。ticket 45 的内联指示为权威方案:

1. 删除 data-golden job 的 `continue-on-error: true`
2. 移除主 lane 两个 Run tests 步骤的 `BOXING_EXCLUDE_GREP: '@data-golden'` env(门禁折入阻塞全量套件)
3. 专用 data-golden job 保留(变阻塞)

## 2. 实施

三处编辑,全部落在 `.github/workflows/test.yml`(1 file changed, 7 insertions, 15 deletions):

| 编辑 | 内容 |
|---|---|
| E1 | Linux lane Run tests:删除 ticket-45 注释 + `env: BOXING_EXCLUDE_GREP: '@data-golden'` 块 |
| E2 | 非 Linux lane Run tests:同 E1 |
| E3 | data-golden job 头:删除 `continue-on-error: true`,注释改写为 ticket-54 关闭说明(job 保留、变阻塞、折入主 lane 的双重覆盖为有意保留) |

YAML 校验(js-yaml load):jobs = test, data-golden;data-golden 无 continue-on-error 键。文件 LF、无 BOM,`git diff --check` 干净。

## 3. 验收证据(issues/54 三项)

### AC-1: continue-on-error 已摘除 ✅

- 文件内 `continue-on-error` 出现次数 = **0**(grep 实证)
- `BOXING_EXCLUDE_GREP` 出现次数 = **0**(env 与注释全部清除,grep 审计干净)
- data-golden job 保留且无 continue-on-error(js-yaml 解析实证)
- commit `szs` = b3ccbf7,推送到 origin/ticket/54-data-golden-blocking

### AC-2: @data-golden 相关 spec 绿 ✅(CI run 34637028614)

CI 证据(gh run view 34637028614,分支 ticket/54-data-golden-blocking,workflow_dispatch 触发):

- **data-golden 专用 job(现在阻塞)**: `data-golden | completed | success` — Running 7 tests,7/7 绿。job 不再豁免失败,任何红都会让 run 红。
- **主 lane 折入验证**: 基线(main 分支 run 34626507101)主 lane "Running **510** tests"(7 个 gate × 2 项目 = 14 个被 grepInvert 排除);t54 run 主 lane "Running **524** tests"(510+14)——**@data-golden 7 gate × chromium/firefox 两项目已折入阻塞全量套件并全部通过**:
  - macos: 496→510 passed(+14)
  - ubuntu: 497→508 passed(+14,含 1 flaky 重试通过)
  - windows: 497→510 passed(+14)
- **两 lane 失败集合均不含 data-golden**(实证:失败列表 grep data-golden = 0)

### AC-3: 逾期豁免登记 ✅(不适用)

期限 2026-09-18,完成日 2026-09-12,**未逾期**,无需 G-A 豁免登记(A-010/A-008 不触发)。

## 4. 主 lane 红(main)的既有失败 — 非本票引入

t54 run 主 lane 三 OS 红(8/10/9 failed),但与基线(main run 34626507101,9/10/8 failed)逐条对照:

- **共同失败**(title-select-all 大/小/crumb ×2 浏览器、empty-state Bug5-dark ×2、state-sync concurrent、auto-expand chromium)= 10 项完全同源 — 主分支既有,属并行车票(52/url-open-mode、49 等)的暂态工作区状态,与本票无关。
- t54 独有 +1: firefox auto-expand(基线 chromium 侧同测试已红,同 flaky 家族)。
- 基线独有 -3: snapshot-rotation ×2、zoom-dblclick(t54 run 中转绿/重试通过)。
- **关键结论: 两个 failset 的差集都不含 data-golden;摘除前后差异仅为 flaky 波动。**

本票改动只增测试覆盖(+14 全绿),不触碰任何产品代码;主 lane 既有红不影响本票验收(验收对象是 data-golden 相关 spec 的绿)。

## 5. 版本控制

遵循 WORKFLOW §4.2(GitButler):

- commit szs(b3ccbf7): `ci(t54): remove data-golden continue-on-error + main-lane exclude-grep env (ticket 45 burn-in close-out)` — 仅含 .github/workflows/test.yml
- 推送 origin/ticket/54-data-golden-blocking(new branch),CI run 34637028614 由该分支触发

## 6. 结论

票 54 完成:t45 burn-in 周结束,门禁双重覆盖(专用阻塞 job + 主 lane 全量)均已生效且绿;未逾期;主 lane 既有红与 data-golden 无关,留给对应车票。
