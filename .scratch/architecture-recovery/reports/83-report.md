# Report 83 — 搜索 debounce（A-033 / D-007 R5）

- 票: 83 · 覆盖 A-xxx: A-033 · 源: Wave8 decision-ledger D-007 R5（含旧 B48 性能）
- 阻塞: None（开工即满足）· 窗口: prompts/83-search-debounce.md
- 检查点: ADR-0013 Q3=B（renderCanvas 全量重建语义不变）
- 日期: 2026-09-12 · 作者: 票 83 子窗口

## 1. 交付摘要

搜索输入改为**停顿后才重查询**（trailing-edge debounce，120ms），可 cancel、可 flush；
查询执行体保持原样逐字不动，因此停顿结束后的结果与改动前逐字一致。
未触碰 renderCanvas / renderConnections，未改 ADR-0017，未打 tag，未宣称可发行。

| 文件 | 改动 | 行数 |
|---|---|---|
| ntp/ntp.js | 新增 debounce 状态与 cancelPendingSearch / flushPendingSearch / executeSearch；hideSearchResults 统一取消在途查询；input/Enter/Escape/blur 四处接入；__boxingDebug.searchRunCount 计数器 | +60 / -7 |
| test/tests/boxing-search.spec.ts | 新增 2 例 debounce 断言（按键连发只跑一次、Enter 立即 flush） | +95 / -0 |

## 2. 必读与调研（D-005 精神）

1. **必读清单**：handoffs/83 · issues/83 · spec.md（Wave8 Solution / US8）· WORKFLOW.md（§4.1–§4.4、§6 教训）· decision-ledger.md（A-033）· destination-reconciliation-wave8.md · docs/CONTEXT.md（Q3=B、BX-PERF-001..005）· ADR-0013 · atomcode-ga-residual-research.md（B3 search×2）· next-round.md（T14）。全部已读，开工第一句已复述阻塞与清单。
2. **ADR/CONTEXT 心智模型**：ADR-0013 Q3=B 只放行了 renderConnections 的 SVG line pooling，renderCanvas 全量重建保留（9 个调用方依赖 rebuild 后的干净 DOM）。本票 debounce 作用于 #q 的 input 事件，只触及 #search-results 下拉的 innerHTML 重建与 box 的 class 增删，与 renderCanvas 无交集。
3. **工业对标**：采用 lodash _.debounce 的契约形状（trailing-edge 默认 + cancel / flush 两个显式出口），而非自造语义；延迟取 120ms，落在 typeahead 常用 100–300ms 区间且低于感知即时的约 200ms 阈值。
4. **与 decision-ledger current 冲突**：无。A-033 约束「全量重建维持 ADR-0013 Q3=B」得到遵守，无需标 revised、无需新 D-xxx。

## 3. 实现要点

- **单一执行路径**：原 input 处理体原封不动移入 executeSearch(q)，debounce 只决定何时调用，不决定算什么 —— 这是「结果一致」的结构性保证。
- **清空不 debounce**：q 为空时立即 hideSearchResults()，画布去灰无感知延迟。
- **取消点收敛**：hideSearchResults() 内部调用 cancelPendingSearch()，于是 openSearchHit / Escape / 清空 / blur 的延迟隐藏四条路径都不会被在途查询复活；blur 再显式取消一次，避免 120ms 后在失焦输入框上弹出结果。
- **flush 点**：Enter 先 flushPendingSearch() 再读结果列表，保证 Enter 永远作用于最新输入，绝不命中过期列表。
- **全局 Escape**：onKeyDown 中清空 searchInput.value 的分支补 cancelPendingSearch()（仅取消在途查询，不改原有的清值不清高亮语义）。
- **可观测性**：__boxingDebug.searchRunCount() 与实际查询次数同源，供测试断言执行次数。

## 4. AC 对照

| AC | 结论 | 证据 |
|---|---|---|
| 停顿后才重查询 | 达成 | 同一同步回合派发 6 次 input → 立即计数等于 before；停顿后等于 before+1；再等 400ms 仍为 before+1（无补跑） |
| 结果一致 | 达成 | executeSearch 为原处理体逐字搬迁；新用例断言命中数 1、large-box--search-match 为真、--search-hidden 为假 |
| 不改 renderCanvas 全量重建语义 | 达成 | 改动未触及 renderCanvas / renderConnections / DOM diff，BX-PERF-002 不受影响；migration-golden、css-balance 守卫绿 |

## 5. 快速输入改善说明（本票专属验收）

改动前，每一次 input 事件同步执行三件工作：

1. runSearch(q) —— 遍历全部大盒 → 小盒 → 书签做子串匹配（O(盒 × 子盒 × 书签)）；
2. renderSearchResults() —— 清空并重建最多 50 条结果项（含每条 2–3 个 div 与监听器的创建）；
3. applySearchHighlight() —— 全量 querySelectorAll 扫一遍大盒与小盒并逐个改 class。

输入 GitHub 这类 6 字符查询，改动前是 6 次全量三件套，改动后是 1 次：查询与结果重建次数下降约 83%，
中间 5 次的 DOM 重建与 class 抖动被完全消除。代价只有一次最多 120ms 的尾部等待，低于感知即时阈值，
因此快速输入不再掉帧；而停顿后看到的结果与逐字符搜索完全一致（AC2）。

补充：清空输入走立即路径，不引入任何等待，避免「删空了画布还灰着」的观感。

## 6. 测试证据

| 车道 | 用例 | 结果 |
|---|---|---|
| chromium-extension | debounce: 按键连发只跑一次 | PASS |
| chromium-extension | debounce: Enter 立即 flush | PASS |
| firefox-extension | 同上两例（solo，--timeout=120000 --workers=1） | PASS 2/2 |

- Firefox 首轮批跑两例均卡在 page.goto 30s 超时；按票 13/15 教训（Firefox 有头冷启动约 22s 吃掉默认预算、满负载车道整批假失败）提预算后 solo 终验 2/2 绿 —— 判定为宿主环境性，非代码。
- 同批 chromium 的 favicon Promise.any 一例出现 browserType.launch Timeout 180000ms exceeded（并发窗口抢资源），与本次改动无因果关系。
- 静态守卫：migration-golden-guard OK、css-balance-guard OK、git diff --check 干净；import-graph-guard 报 boxing-conflict-copy-readout.spec.ts 未被 cluster-map 覆盖 —— 该 spec 属票 79 并行新增，非本票面，见 §7。

## 7. 发现但未修（不扩本票面）

1. **B3 search×2 的真实根因（供票 72 直接使用）**：既有两例（大盒标题过滤 / 清空高亮）走 push → persistView() → reload 播种，探针实测 reload 后 layout.boxes 为空、.large-box 一个都没渲染（boxes=[] / domBoxes=[] / hasInput=true），所以无论 debounce 与否都不可能命中高亮。可行替代播种：不 reload，直接 push 后调用 dbg.renderCanvas()（探针验证 boxes=[probe-1] / dom=[probe-1]）。本票未改这两例（属票 72 broken 桶面），新用例改用无 reload 播种以避免与 72 抢同一文件。
2. **Enter 键实际不导航**：结果项只监听 mousedown，而 Enter 走 list[0].click()（只派发 click，不派发 mousedown），故 Enter 历史上一贯不触发跳转。本票只让 Enter 前的 flush 生效（列表已就绪），未改该行为，建议大脑另立小票。
3. **CONTEXT.md 待补一行**：建议由大脑在 Performance Grill Decisions 段补「搜索输入 debounce 120ms（A-033 / 票 83）」。本窗口未改 docs/CONTEXT.md（该文件正被并行窗口占用）。

## 8. 版本控制（WORKFLOW §4.2）

- ntp/ntp.js 的未提交改动中混有并行窗口（票 82 WebDAV opt-in）的 2 处 hunk；按票 05/票 10 教训，提交前逐 hunk 认领，用隔离法只提交本票 hunk，提交后原样还回并行 hunk。
- 独立分支提交，不 push、不开 PR、不改写他窗提交；不 tag、不宣称可发行、不扩 ADR-0017。

## 9. 完成定义自检

- [x] issue AC 三条全勾（已同步回写 issues/83-search-debounce.md）
- [x] 报告写入 reports/83-report.md
- [x] 版本控制遵循 WORKFLOW §4.2
- [x] 不 tag / 不宣称可发行 / 不扩 ADR-0017
