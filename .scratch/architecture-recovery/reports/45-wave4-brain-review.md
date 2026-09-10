# 45 — Wave4 首脑实物复核（票 09–13）

> 日期: 2026-09-10 · 角色: 架构首脑 · 方法: Node 源码断言 + git 实物，不信报告自述
> 基线: main a60754b

## 总表

| 票 | 分支 @ tip | 源码 | 报告 | 状态 |
|---|---|---|---|---|
| 09 create-render | ticket-09-create-render @ mno,ptw | PASS | 09-create-render-decouple-report.md | DONE-CI-OPEN |
| 10 title-select-all | 10-title-select-all @ out（落点异常） | PASS（树内） | 10-title-select-all-report.md | DONE-CI-OPEN + VIOLATION |
| 11 url-open-mode | ticket-11-url-open-mode @ qwo,kqx | PASS | 11-url-open-mode-default-report.md | DONE-CI-OPEN |
| 12 favicon-swr | ticket-12-favicon-swr @ kow,ylu | PASS | 12-favicon-cache-hardening-report.md | DONE-CI-OPEN |
| 13 dark-bm-add | ticket-13-dark-bm-add-btn @ wzp,wnl | PASS | 13-dark-bm-add-btn-report.md | DONE-CI-OPEN + VIOLATION |

---

## 09 — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| mutate 后立即 render | addLargeBoxAt: push@1497 < renderCanvas@1878 < voidSave@2180；addLargeBox 同序；addSmallBoxAt: renderInner@1537 < voidSave@1565 | PASS |
| 全文件无 await saveLayout | await 计数=0；void saveLayout=3 | PASS |
| 不改 storage 写链 | git diff 仅 render.js + boxing-create-render-decouple.spec.ts + report | PASS |
| 测试门 | 新 spec 存在；node --check render.js 绿 | PASS / Playwright CI-open |
| issue 验收 | checked=6 open=0 | 已勾 |

**结论 09: DONE-CI-OPEN**（void 落盘，票面 AC 允许 void 或 debounced）。

## 10 — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| 共享 select-all helper | selectAllTitleText = focus + selectNodeContents + Selection | PASS |
| 三处接入 | large/small/crumb mousedown 均调用；call sites 含 3 接入点 | PASS |
| 不碰创建管线 | 与 09 一致 void=3 await=0 | PASS |
| 测试 | boxing-title-select-all.spec.ts 存在 | PASS / CI-open |
| 独立分支落位 | 本票 tip 仅 landing note；改动在 13 的 2ce2c41 | 归属失败 |

**结论 10: 源码 PASS · V-W4-1**

## 11 — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| 默认 sameTab | defaultLayout + openBookmarkUrl + settings-ui fallback 均 sameTab | PASS |
| 缺键 migrate / 保留 newTab | migrate settings 用 defaults 展开：缺键填 sameTab，显式 newTab 胜出 | PASS（等价） |
| popups 缺键当前标签 | 仅显式 newTab 走 tabs.create | PASS |
| 文件面 | a7dddf2: utils/ntp/settings-ui/popups + settings-persist.spec | PASS |
| issue 验收 | checked=5 open=0 | 已勾 |

**结论 11: DONE-CI-OPEN**。残留：旧版曾持久化 newTab 的用户升级后仍 newTab（报告已披露、spec 已裁决）。

## 12 — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| single-flight | inflight Map + forget | PASS |
| SWR hydrate | stale 先画 + 后台一次刷新 | PASS |
| 不扩权/无 IDB | 无 indexedDB；文件仅 favicon.js | PASS |
| Promise.any 源契约 | 仍留在 loadFavicon 体内 | PASS |
| 测试 | 沙箱 21 断言 + 既有 search 契约；无新 Playwright | PASS / CI-open |

**结论 12: DONE-CI-OPEN**

## 13 — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| dark transparent | .ntp--dark .bm-add-btn background: transparent | PASS |
| 遗产 button 规则已删 | .ntp--dark .bm-add-row button 不存在 | PASS |
| hover 保留 | accent-soft/accent/accent-ink 仍在 | PASS |
| 提交只含本票 | 2ce2c41 含 10 的 render.js/spec/报告 | 违规 |

**结论 13: 源码 PASS · V-W4-1 肇事提交**

## 过程违规（不追认）

### V-W4-1 P0 — 窗 13 提交卷走窗 10 未提交改动

- commit 2ce2c41 文件含: ntp/render.js, test/tests/boxing-title-select-all.spec.ts, reports/10-title-select-all-report.md（票10）+ settings.css, boxing-empty-state-buttons.spec.ts（票13）
- 10 tip fe967cb 仅 landing note；13 报告称未触碰其它窗口 — **与 git 实物矛盾**
- 处置: 不代历史手术；树内内容 PASS；分支归属修复需用户授权
- 教训: 多窗并行必须 but diff 逐 id 认领，禁止无 id 整包 commit

### V-W4-2 NOTE — 全员 CI-only

Playwright 全量绿待 CI；合并前补取证。

## Frontier

```
票包内: 无剩余 — 09-13 全部 code-done
下一波 = 收口门（与 01-08）:
  CI 绿: 01/03/04/05/07/08 + 09/10/11/12/13
  人工: Pages Source；AMO 2026.9.12 占用
  合并建议: 09 → 10(文件在13提交) → 11 → 12 → 13 → docs
  待授权: 是否把 10 文件从 2ce2c41 拆回 10-title-select-all
```

## 源码层重发判定

**无需重发修复启动器** — 五票源码层均 PASS。仅 V-W4-1 待用户裁决。
