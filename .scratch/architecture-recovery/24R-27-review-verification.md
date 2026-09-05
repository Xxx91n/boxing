# 24R / 27 独立复核验证

> 只读复核，不修改源码、README、测试或状态表；仅写入本报告。
> 工作区：D:/Aworker/crx/boxing
> 生成日期：2026-09-05

## 1. 最终判定

| 票 | 判定 | 源码层面问题 | 重发修复启动器 |
| --- | --- | --- | --- |
| 24R | PASS with residual | 无 | 否 |
| 27 | PASS with residual | 无 | 否 |

## 2. 取证基线

- `git diff --check`：exit 0，无输出。
- `node scripts/import-graph-guard.mjs`：exit 0，14 modules / 48 edges / 0 violations。
- `npm run test:quarantine`：exit 0，0 tests（wrapper 输出仅脚本头，无失败）。
- `npx playwright test --config=test/playwright.quarantine.config.ts --grep=@quarantine --list`：Total: 0 tests in 0 files，不带 `--pass-with-no-tests` 时 exit 1 报 No tests found；该结果反向确认 `--pass-with-no-tests` 是当前空车道 exit 0 的必要条件。
- `but status -fv`：两个目标分支均已落位；`zz` 未提交区存在。

## 3. 票 24R：issue/24 完成定义对照

### 3.1 修复 delta

- `git diff --stat c0f6b8f 9a96a24`：12 files，39 insertions(+)，66 deletions(-)。
- `git diff --name-status c0f6b8f 9a96a24`：11 个 `docs/i18n/README.*.md` 为 M，另有 `24-readme-beautify-language-entry-repair-report.md` 为 A；没有 README.md、manifest.json、测试、源码或脚本。
- 11 个 locale 的 diff 只删除每个文件两处 `> [!NOTE]` 占位块（NOTE 行 + 本地化文案行 + 前导空行），每个文件 -6 行；`<picture>` 与真实截图引用未变。

### 3.2 逐项验收

| Acceptance criterion | 证据 | 结论 |
| --- | --- | --- |
| 顶部只保留一个语言选择器并删除页脚重复 | 根 README 1 条 `Languages:`；13 个 docs/i18n 文件每条恰 1 条；`README-I18N:START:FOOTER` / `END:FOOTER` 全仓 0 | PASS |
| 用现有五张 PNG 替换占位且本地图片链接全部可解析 | `^> [!NOTE]` 在 docs/i18n 与根 README 为 0；5 张截图 PNG 均存在于 `docs/store-assets/screenshots/` 且被引用；独立扫描 338 个本地引用，0 断链 | PASS |
| 安装/使用/隐私/开发命令仍与 package.json 一致 | 24R delta 未触碰 README.md 或 package.json；当前 package.json scripts 已复读，README 命令面未被本修复改变 | PASS |
| 本地化 README 生成契约兼容 | `scripts/gen-i18n-readme.js` 不在 24R delta；README-I18N:START/END 仍位于 L1/L3；首个 `## ` 为 L50 `## What Makes It Different`；`## Quarantined tests` 存在 | PASS |
| 本地链接、图片路径、行尾、git diff --check | 0 断链；14 个目标 markdown 文件 LF、0 CR 字节；`git diff --check` exit 0 | PASS |
| 写出 handoff 指定闭口报告 | `24-readme-beautify-language-entry-repair-report.md` 存在且已进入分支 commit；原始 `24-readme-beautify-language-entry-report.md` 也仍存在 | PASS with residual |

### 3.3 24R residual

- 原始 `24-readme-beautify-language-entry-report.md` 的 §2.2/§6.1 仍保留错误的 0 占位声明；24R 仅在 repair report 中记录纠正，未改原始报告。
- `issues/24` 文件仍显示 ready-for-agent 且 6 个 checkbox 未勾，且该 scratch 文件在未提交 `zz` 区；这不是文档文件实际状态问题，但元数据没有跟随修复闭环。
- 无源码层面问题；24R 的修复文件本身达标，不需要重发修复启动器。

## 4. 票 27：issue/27 完成定义对照

### 4.1 变更范围

- 实施提交 `645192c`：`git diff --stat 05e399b 645192c` = 10 files，264 insertions(+)，72 deletions(-)。
- 文件名 = 7 个 spec（`boxing-focus-steal`、`boxing-innerclip-pan`、`boxing-onboarding`、`boxing-v3`、`boxing-webdav`、`data-recovery`、`extension-test`）+ 2 个 config + `package.json`。
- 文档/报告提交 `9726539`：`git diff --stat 645192c 9726539` = 10 files，198 insertions(+)，39 deletions(-)，含 README、quarantine.yml、任务书三件套与报告。

### 4.2 14/14 repair 而非只改 README

- `git diff 05e399b 645192c -- test/tests` 显示 14 个 `@quarantine` test 标题全部移除，且每个标题均保留并改名（无 test 删除）。
- 同一 diff 显示 3 个新增合成孪生测试（focus-steal 的 seeded Selection 覆盖），不是退役原测试。
- `test/playwright.config.ts` 无 `grepInvert`；firefox project 注释改写为收敛叙事。
- `package.json` 的 `test:quarantine` 含 `--pass-with-no-tests`。

### 4.3 逐项验收

| Acceptance criterion | 证据 | 结论 |
| --- | --- | --- |
| 跑专用 quarantine lane 并识别每条残余失败 | 当前 quarantine lane 独立复跑 0 tests / exit 0；修复前基线 14/14 chromium、firefox 0/14（workers=2）与 solo 12/2 的分类仅来自报告自述，未在本次复核重放历史 commit | PASS（修复后 lane 已独立验证；修复前基线仅报告证据） |
| 每条 repair 或 retire 并记录决策，不得自动延长 | 14 个 tag 摘除、14 个标题保留、0 个测试删除、3 个合成孪生新增；无到期延长路径 | PASS |
| README quarantine 表反映新 Chromium/Firefox 计数 | README 表为 1 行空表占位 + 收敛声明；记录 14/14 双车道基线 | PASS |
| 修复后验证 Firefox lane 与 quarantine lane | quarantine lane 独立复跑 exit 0 / 0 tests；firefox 主 lane 219 passed / 3 skipped / 0 failed 为报告自述，本次复核未重跑 222 项全量 | PASS with residual（全量 firefox 主 lane 未独立重放） |
| 闭口报告存在 | `27-firefox-quarantine-convergence-report.md` 存在且已提交 | PASS |

### 4.4 票 25 遗留 state-sync 是否被触碰

- `git diff --name-only 05e399b 9726539` 未包含 `boxing-state-sync.spec.ts`、`ntp/utils.js`、`scripts/test-mutex.mjs`、`scripts/test-surface.mjs`、`test/cluster-map.json`、`background.js`、`manifest.json`。
- 票 27 未触碰票 25 遗留的 3 个 `boxing-state-sync` 失败。

## 5. 过程违规审查

- 24R 的 `but amend`：目标是自己票 24 所属 commit，未改其他窗口提交；符合 WORKFLOW §4.2 的“小修复 amend 进所属 commit，不造 fixup 垃圾”。未见违规。
- 27 的两次 `but move --above`：`but status -fv` 显示栈序为 27 > 18 > 25，依赖 ticket18 测试行与 ticket25 package.json 行，符合 ticket10 依赖栈恢复；未改写其他窗口 patch 内容。未见违规。
- 未发现 24R/27 越权提交他票 scratch issue/handoff/prompt；23-26 任务书及 `spec.md`/`round5` 仍在 `zz` 未提交区。
- 27 未发现跨票动码或产品源码变更。

## 6. 需要呈报的 residual

- `test/playwright.quarantine.config.ts` L17 仍保留一行 `quarantine-ref` 注释；这与 27 报告声称的“`quarantine-ref` 注释全仓清零”不符。它不是 test 标签，也不影响执行，但属于报告/实物不一致。
- 修复前 quarantine 基线与最终 222 项 Firefox 主 lane 结果未在本次只读复核中独立重放，只能依据提交 diff、配置与报告时间序佐证。
- 原始 24 闭口报告的 0 占位声明未随 24R 修正。

## 7. 最终结论

- 24R：`PASS with residual`。占位块、语言条、页脚、PNG、断链、行尾、diff check 均达标；residual 为原始报告元数据声明不一致。
- 27：`PASS with residual`。diff 与当前配置证明 14/14 repair、0 retire；residual 为 quarantine config 中一条历史 `quarantine-ref` 注释与全量 firefox 主 lane 未独立重跑。
- 两者均无源码层面问题，不需要重发修复启动器。

