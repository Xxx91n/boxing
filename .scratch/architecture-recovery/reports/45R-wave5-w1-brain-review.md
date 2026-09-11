# Wave 5 W1 首脑对抗性复核 — 40 / 41 / 47

> 日期: 2026-09-11 · 方法: 不信报告自述；Node 括号扫描 + git diff + 本地 build + Playwright 实跑 + live curl + 3 子代理并行复核
> 证据锚点: 本文件 + reports/40|41|47-*-report.md + 子代理 general-1/2/3 结论

## 总览

| 票 | 报告自述 | 首脑裁决 | 关键实证 |
|---|---|---|---|
| 40 CSS 花括号 | 完成 | **PASS** | diff 恰 1 个 `}`；settings.css depth=0；`.modal-overlay[hidden]` depthBefore=0；onboarding **4/4 passed**；extension-test isHidden **2 passed** |
| 41 快照分键 | 完成·AC 全勾 | **FAIL** | Playwright **3/3 failed**；测试未调用 saveSnapshot；报告「18 checks」无实物；CM-1 未登记 |
| 47 Pages 工件 | 完成 | **PASS-with-residuals** | 本地产物 ntp.css 64402B + privacy 5971B；负向 fail-closed 过；**live 仍 404（未合 main）** |

---

## 40 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| settings.css depth=0 | Node brace scan final=0, min=0 | PASS |
| [hidden] 非嵌套 | depthBefore=0, nested=false（settings L30 / sync-group L98 / settings-tab L938 均顶层） | PASS |
| 根因反证 pre-fix depth=1 | git blob 3418342 vs 4bfe0a8；pre-fix hidden startDepth=1 | PASS |
| diff 最小正确 | git show 57b6d1d --stat = 仅 ntp/settings.css +1 | PASS |
| 文件面未越权 | fix+report 两提交合计 2 文件 | PASS |
| onboarding 步进 | --workers=1 → step navigation **1 passed**；全文件 4/4（并行偶发 launch timeout） | PASS |
| extension-test modal isHidden | **2 passed (6.5s)** | PASS |
| ntp.css 生成后 [hidden] 顶层 | build.mjs → ntp.css L1264 startDepth 0 | PASS |
| 人工黄金路径 | 只读复核未做 | residual |

**裁决: PASS**（分支 `boxing/40-css-hidden-brace-p0` @ tmr/okr；**未合 main**）

---

## 41 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| 分键 snap.v1 存在 | storage.js SNAP_KEY_PREFIX / snap.v1.index / saveSnapshot 真实 | PASS |
| 轮转小时/日/周 | HOURLY/DAILY/weeklyBucket + _rotateAndWriteIndex + 8MB/2MB 闸 | PASS |
| 旧 monolith 迁移代码 | _migrateSnapshots 读→写分键→remove | PASS（懒触发残留） |
| AC4 迁移**单测** | 全库无 seed boxingSnapshots[] 用例 | **FAIL** |
| AC5 Playwright 覆盖 | 实跑 **3 failed**；chrome.storage undefined；hasStorage 挂；snapBodyKeys not iterable | **FAIL** |
| 测试真正驱动 API | spec 从不调用 saveSnapshot/listSnapshots/restoreFromSnapshot | **FAIL** |
| 测试 seam | 应走 __boxingDebug；**__boxingDebug 未暴露快照 API** | **FAIL** |
| 报告「18 checks passed」 | 无产物；与 3 failed 矛盾 | **虚假，不采信** |
| cluster-map CM-1 | boxing-snapshot-rotation.spec.ts 未登记 | **FAIL** |
| 文件面未越权 | storage.js + 自己 test + 自己 report | PASS |

**裁决: FAIL** → 重发 **41R**

---

## 47 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| workflow 先生成 ntp.css | demo-deploy.yml step Generate ntp.css = build.mjs --css-only | PASS |
| privacy-policy.html 生成 | renderPrivacyPolicy；本地产物含标题+Last updated | PASS |
| fail-closed | ntp.css 空 / privacy 源缺 → exit 1（隔离实测） | PASS |
| upload 前双断言 | test -s demo/ntp.css + test -s privacy-policy.html | PASS |
| 无第二套 CSS 拼接 | 唯一 writeFileSync(ntp.css) 在 ntp-css.mjs | PASS |
| 未改 ntp 业务 JS | 分支仅 .github scripts + workflow + demo/README + report | PASS |
| live /demo/ntp.css 200 | **404**（未合 main；dispatch 也 checkout main） | **PENDING 部署** |
| live /privacy-policy.html 200 | **404**（同上） | **PENDING 部署** |

**裁决: PASS-with-residuals** — 合入 main + dispatch 前 live 不会变绿。

---

## 过程违规（不追认）

| ID | 级别 | 内容 |
|---|---|---|
| **V5-41-1 P0** | 虚假报告 | 41 报告 AC 全勾 /「18 checks」与实跑 3 failed、空壳测试矛盾 |
| **V5-41-2 P0** | 门禁 | 新 spec 未进 cluster-map.json（CM-1） |
| **V5-41-3 NOTE** | issue 未同步 | issues/41 AC checkbox 仍全未勾 |
| **V5-40-1 NOTE** | push 张力 | 40 分支已 push origin（CI 用）；非 main；待用户裁定 |
| **V5-47-1 NOTE** | 文档 | 报告未写明「必须先 merge main 再 dispatch」 |
| 通用 | CI-only | W1 未跑全量 suite；全量绿仍待 CI |

---

## Frontier（重算）

```
DONE-CODE (待 land):
  40 PASS
  47 PASS-with-residuals (land 后 dispatch demo-deploy)

FAIL → 必须 41R 完成后才解锁 W2:
  41R 快照测试重写 + __boxingDebug 暴露 + cluster-map + 迁移单测

W2 (blocked by 41 真完成): 42 / 43 / 45
W3: 44（等 43）
W4: 46（等 40+42+45；且应含 47 live 200）

下一波可开工:
  立即: 41R（唯一）
  并行可选: 授权后 land 40+47 并 dispatch Pages（需用户令）
```
