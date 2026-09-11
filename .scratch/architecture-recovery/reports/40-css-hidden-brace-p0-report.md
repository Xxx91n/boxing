# 票 40 报告 — P0 修复 settings.css 缺失花括号导致 hidden 遮罩失效

- 日期: 2026-09-11
- 窗口: 子窗口实施代理（入口 prompts/40-css-hidden-brace-p0.md）
- 分支/commit: boxing/40-css-hidden-brace-p0 @ tmr（57b6d1d）· 遵循 WORKFLOW §4.2
- 调研: atomcode 2026-09-11（ctx 索引 source=atomcode，handoff 提示词 verbatim）

## 根因

ntp/settings.css 的 .modal-overlay 规则块缺少闭合 }（修复前文件末尾 brace depth=1）。按 css-syntax-3 错误恢复规则（样式表结束时所有未闭合构造「自动闭合」），其后本应顶层的 .modal-overlay[hidden]、.sync-group、.settings-tab 等全部被吞进 .modal-overlay 块内；而 CSS Nesting 对不带 & 的嵌套选择器默认插入隐式后代组合器，实际匹配语义变成 .modal-overlay .modal-overlay[hidden] —— 永远匹配不到遮罩自身。结果 hidden 属性设置后 display:none 兜底失效，display:flex 的全屏遮罩继续拦截指针事件 → 2026-09-12 界面冻结事故（父事故 Issue #9 根因 1）。

## 修复

在 .modal-overlay 规则尾注释块结束后补一个 }（ntp/settings.css +1 行）。diff 仅此一文件；onboarding.css 实测 brace depth=0，拼接边界无需改动；未触碰任何 JS 行为（票面 delta 边界内）。同工作区其他票的未提交改动（build.mjs / ntp-css.mjs / storage.js 等）未动、未卷入本提交（逐 id 认领）。

## 验证

- [x] settings.css 括号最终 depth=0：修复后 Node 全文扫描复核 = 0，且 .modal-overlay[hidden] 之前 depth=0（顶层规则成立）；onboarding.css 复核 = 0。
- [x] npm run build 成功且 ntp.css 中 .modal-overlay[hidden]{display:none} 为顶层规则 → CI run 34565765473 三 OS 全部「Build extension」✓；顶层语义由行为证据坐实（遮罩 hidden 系列测试由红转绿，见下 CI 证据）。
- [x] Playwright: boxing-onboarding step navigation PASS → 基线 main（run 34505298778）该测试在失败名单，本 run 不在；同总数 478 / 同 skipped 3 排除「未跑」假象，判定为红转绿。
- [x] extension-test settings modal close 后 isHidden PASS → isHidden 断言在 extension-test.spec.ts:64（Direct 用例内）；基线 Direct 失败、本 run 不在失败名单 = 红转绿。extension-test:69（Popup 截图）仍败，失败原因 Page.captureScreenshot 协议错误，基线同签名 = 环境性存量，非本票回归。
- [ ] 人工：新装扩展出现引导后可点 Skip/Next，关闭后主界面可点击 → 子窗口无法执行，转 ready-for-human（票面验收第 5 项）。

CI 触发方式：推送 boxing/40-css-hidden-brace-p0 分支后以 workflow_dispatch 定向 --ref 触发 test.yml（含 node .github/scripts/build.mjs 构建步与全量 npm test；不开 PR，遵循 WORKFLOW §4.2）。

## 调研收获（atomcode 结论，非幻觉推理）

- Q1 嵌套解析：无 & 的嵌套选择器一律后代（css-nesting-1 Explainer「descendant combinator」默认语义；MDN/web.dev 同文互证）；要表达嵌套复合必须 & 紧贴。未闭合父块 + 自动闭合 = 后续顶层规则被静默吞为嵌套（不报错、只坏样式）。
- Q2 hidden 覆盖：Chrome/Firefox 的 UA 样式表均无全局 [hidden]{display:none} 规则 —— hidden 实现为「表现提示」（作者源、零特异性），任何作者级 display 声明静默覆盖（Firefox gecko html.css 注释 + Mozilla commit f37be02e/Bug 2051196 白纸黑字；Bugzilla 1437969 旁证）。input[type=hidden] 的 !important 是另一回事。两引擎行为一致，无跨浏览器差异可依赖。BX-DEV-020 的 [hidden] 兜底对因此是强制约定而非可选保险。
- Q3 构建期校验：浏览器对未闭合块静默恢复，故括号平衡必须构建期工具把关；stylelint 报 Unclosed block、postcss 抛 CssSyntaxError、Lightning CSS 严格模式报错、prettier --check 硬失败；不推荐手写 {} 计数（字符串/url()/注释 括号误报）。对本票的启示：本窗用计数做静态自验足够（修复面单行、已复核），但票 41（D6 构建期 CSS 校验）落地时应优先真实解析器路线；Mozilla 官方兜底 :where([hidden]){display:none !important} 可作 D6 之外的纵深选项。
- 信息缺口（如实记录）：未做浏览器 CSSOM 运行时实测（只读模式）；Chrome 表现提示映射文件未逐行核验；均不影响本票修复正确性。


## CI 证据（run 34565765473 · test.yml workflow_dispatch · boxing/40-css-hidden-brace-p0 @ 72aefc8）

- 基线 = main @ 0c5bf1b（run 34505298778，即本分支父提交、未含修复）：Running 478 tests，57 failed，约 418 passed，3 skipped。
- 本票 run：Running 478 tests，9–10 failed（三 OS 车道），464–466 passed，3 skipped —— 同总数同跳过集。
- 净恢复 ≈ 47 个用例，残余失败全部为基线失败名单的真子集，零新增回归。
- 恢复名单（本票直接指向）：boxing-onboarding（step navigation）、boxing-sync-ui-grouping 全部 5 条（provider 互斥 hidden）、extension-test Direct（含 settings modal close → toBeHidden）、boxing-webdav 5 条、boxing-zoom-arrow 2 条、boxing-focus-steal 2 条、boxing-state-sync:86（fixed frame）、boxing-sync-level CSS 2 条、boxing-v3、boxing-debug。与票面「onboarding、extension-test、sync-ui-grouping 相关失败恢复」一致并有大量额外恢复（缺 } 吞掉了半份 settings.css 的全部顶层规则，与 atomcode Q1 结论吻合）。
- 残余失败（wave4 另轨存量，归属其他票）：boxing-title-select-all ×3（基线即败，0c5bf1b 只修了 import）、boxing-auto-expand（票15 登记的 hover 时序抖动）、boxing-empty-state-buttons Bug5-dark、boxing-state-sync:170（票31 host-incident 登记）、boxing-zoom-dblclick:155（windows 车道）、extension-test:69 Popup（chromium 截图协议错误）。

### CI-only 合规说明
本机未执行任何构建/测试（2026-09-04 政策）；本窗仅做 CSS 花括号静态扫描与单行文本修复；全部构建与 Playwright 证据来自上述 CI run/artifact。
## 遗留 / 交接

- CI run 34565765473 已回收（见「CI 证据」节）：本票 4 项自动化验收全绿；整体 test.yml 仍红 = wave4 另轨存量，不属本票收口条件。
- 人工黄金路径项（引导 Skip/Next、关闭后主界面可点击）转 ready-for-human。
- 票 41 若实现 D6 校验器，参考上方 Q3 工具路线；本票不越票动 build.mjs。
