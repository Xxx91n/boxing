# 87 — R1 star-sync Scenario 1 三 OS 修绿（A-041）

> Covers: A-041 · 镜像 GitHub #10 · Blocked by: None · 窗口: Boxing Wave9 实施子窗口
> 日期: 2026-09-13 · 目标版本 2026.9.15（持有 2026.9.12，不热修）

## 0. 调研摘要（handoff 通用调研三项，先于实现）

### 0.1 深度调研：跨 tab 状态同步测试的工业成熟方案

**推荐**：以「同一 BrowserContext 内的多个 Page」模拟多 tab，并把「清存储」做成显式可选动作，而不是写死在通用 boot 夹具里。

**理由（工业证据）**：

1. 多 tab 同步必须在**同一个 BrowserContext** 内开多个 Page。Chromium 下不同 BrowserContext 不仅隔离 IndexedDB/localStorage，也隔离 BroadcastChannel —— 用两个 newContext() 模拟「多 tab」是该场景的经典误用，表现为 100% 失败而非偶发。来源: DEV《Playwright Multi-Tab IndexedDB Sync: The Browser Context Isolation Trap》(2026-05)。
2. 断言同步结果应轮询（waitForFunction / expect.poll）而非固定 waitForTimeout。Playwright 官方对比 Cypress/Puppeteer 的核心卖点即等待异步事件更成熟、省掉大量 waitForTimeout；固定 sleep 是慢速 CI runner 上 flake 的主因。来源: Playwright 官方 Isolation 文档（browser-contexts）。
3. 测试隔离由 context 生命周期保证（每例新建 context、用完 close），故「清存储」只在**种子页面**需要；在**期望从存储领养状态的页面**上清存储，等于删除被测数据本身。

### 0.2 ADR / CONTEXT 现有心智模型回顾

| 来源 | 现行模型 | 是否冲突 |
|---|---|---|
| docs/CONTEXT.md「Box Key Format」 | layout.groups 自 ADR-0007 Phase 1.1 起 runtime-only、永不持久化（stripGroupsForPersist）；星标真值是 box.isParent；零连接的星标父盒仍走 dsuMake 以保证 getGroupByParent 可用 | 不冲突：实测 boxingLayout 含 isParent 且无 groups |
| docs/CONTEXT.md「Boxes」 | isParent = 星标，DSU 组的移动 leader | 不冲突 |
| ADR-0003 | 星标落在 box 上而非 layout.groups | 不冲突，本票未触碰产品侧 |
| ADR-0007 Q1 | 一次性迁移：从旧 layout.groups 还原 box.isParent | 不冲突 |
| ADR-0017（2026-09-13 修订） | R1 boxing-star-sync-audit Scenario 1 = B 稳定残红（三 OS） | 定谳**修正为测试缺陷**；分桶字号不变，**不引入 waiver** |

**无静默改向**：未修改任何 ADR / CONTEXT 断言；产品代码零改动。

### 0.3 工业对标（实现 / 测试策略）

- **测试 seam**：沿用既有 test/tests/boxing-*.spec.ts Playwright 扩展 seam，未引入新框架（符合 spec.md Testing Decisions）。
- **CI 工位策略**：本机 8 线程下并发 8 个 headed 浏览器会互相饿死，仓库已把本地 workers 固定 4、CI 固定 2（ticket 20）。本次实测复现该现象：同机并发 6 个 headed 用例（workers=4）时出现 EmptyDatabaseError、connector disposed 等环境级崩溃，属**本机资源争用**，非产品缺陷。
- **flaky 治理**：CI 保留 retries: 2；本票另把 Scenario 1 的固定 600ms sleep 换成 expect.poll（超时 10s），从机制上去掉慢 runner 的时序 flake。

---
## 1. 根因定谳：测试缺陷（非产品、非环境）

### 1.1 现象

test/tests/boxing-star-sync-audit.spec.ts Scenario 1 在 chromium 本地复现为：

```
Scenario 1: starB = null
Expected: true
Received: null
```

关键判别点：返回值是 **null**（layout.boxes.find 未命中该 id），**不是 false**。
即问题不是「新标签把星标弄丢了」，而是「新标签里根本没有这个盒子」。

### 1.2 根因

夹具 boot(page) 无条件清空存储：

```ts
async function boot(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); // 无条件
  await page.reload({ waitUntil: 'domcontentloaded' });
  ...
}
```

而 Scenario 1 的语义是「tab A 存盘 → 打开新标签 tab B → tab B 从存储领养星标」。
boot(b) 在 tab B 上执行时，把 tab A 刚持久化的 boxingLayout 直接清空了。
用例因此自相矛盾：要求 tab B 领养一份自己刚删掉的数据 —— 在三 OS 上必然、稳定失败，与「B 稳定残红」定性一致。

### 1.3 反证（证明产品侧正确）

一次性诊断脚本（同 context、tab B 保留存储；已删除，不入库）重跑同一流程：

```
boxingLayout => {"version":3.5,"schemaVersion":1,"boxes":[{"id":"large-mtzv7qtg-...","type":"large","title":"Box 1",...}]}
isParent substring present in localStorage: true
== tab B (storage preserved) == {"boxCount":1,"found":true,"isParent":true}
== page errors == none
```

结论：星标经 box.isParent 持久化、被新标签正确领养，**产品链路无缺陷**。
附带印证 CONTEXT.md「layout.groups 永不持久化」—— 持久化载荷中只有 isParent，无 groups。

---
## 2. 修复

只改测试夹具与用例，**产品代码零改动**：

1. boot(page, opts) 新增 { reset?: boolean }，缺省 true（行为不变）；reset: false 时跳过 localStorage/sessionStorage.clear()。
2. Scenario 1 的 tab B 改为 await boot(b, { reset: false })，恢复「fresh tab 从存储领养」的真实前提。
3. Scenario 1 的固定 waitForTimeout(600) + 单次读取，改为 expect.poll(...).toBe(true)（超时 10s）。断言谓词与期望值**完全未变**（仍要求 isParent === true），只去掉固定 sleep 带来的时序 flake；保留原 expect(starB).toBe(true) 以便审计对照。

**未做**：未放宽任何断言、未加 skip、未加 waiver、未热修 2026.9.12。

---

## 3. 验证锚点

| # | 锚点 | 命令 | 结果 |
|---|---|---|---|
| A1 | 修复前复现 | npx playwright test --config=test/playwright.config.ts --project=chromium-extension --grep "Scenario 1" --reporter=line --retries=0 | Scenario 1: starB = null → **1 failed** |
| A2 | 产品侧反证 | 一次性诊断脚本（同 context、tab B 保留存储） | boxCount:1, found:true, isParent:true；无 page error |
| A3 | 修复后 chromium | npx playwright test --config=test/playwright.config.ts --project=chromium-extension test/tests/boxing-star-sync-audit.spec.ts --reporter=line --retries=0 | **3 passed**（S1 starB=true；S2 true；S3 before=true / after=false） |
| A4 | 修复后 firefox | 同上，--project=firefox-extension | **3 passed**（S1 starB = true） |
| A5 | 修复后 CI 参数合跑 | CI=true npx playwright test --config=test/playwright.config.ts test/tests/boxing-star-sync-audit.spec.ts --reporter=line（workers=2, retries=2） | **6 passed**（chromium+firefox × 3 场景） |
| A6 | 仓库守卫 | npm run pretest | import-graph OK（15 模块 / 48 边 / 0 违规）；migration-golden 28/28；css-balance OK |

**本机环境噪声（非产品缺陷，已排除）**：同机并发 6 个 headed 浏览器（workers=4）时 firefox 出现 services.settings EmptyDatabaseError 与 connector disposed，属本机资源争用；按 A5 的 CI 参数（workers=2）重跑 6/6 全绿。

---

## 4. AC 对照

| # | AC | 状态 | 说明 |
|---|---|---|---|
| 1 | 根因结论写入 reports/87-report.md（产品/测试/环境） | 达成 | 定谳为**测试缺陷**；见 §1，含反证 A2 |
| 2 | 修复后 test.yml 该签名三 OS 非 failed；附 run URL | **待明令 push** | 本地 chromium + firefox 双 lane 全绿（A3/A4/A5），但「三 OS」的合法证据是 GitHub test.yml run URL。WORKFLOW §4.2 与 handoff 均禁止未明令 push，故本票不自行推送；run URL 待用户授权后补。 |
| 3 | 不引入 waiver；不热修 9.12 | 达成 | 无 skip、无 waiver、无断言放宽；未触碰 2026.9.12 产物 |

---

## 5. 遗留与请求

1. **需用户明令**：授权推送以触发 test.yml，补齐 AC2 的 CI run URL（三 OS × ff+ch）。在此之前本票记为 fixed-pending-ci，**不宣称 G-A 成立**。
2. **对 A-047 的输入**：R1 由「B 稳定残红」改判为「测试缺陷已修」，A-047 合并残红台账时按此更新分桶来源，勿重复计票。
3. **建议（不属本票）**：boot() 类通用夹具把「清存储」写死是模式性隐患，其余多 tab 用例（boxing-state-sync / boxing-viewstate-sync 等）若有同样「领养页」语义，应在各自票内核查。

## 6. 版本控制

遵循 WORKFLOW §4.2：but diff 确认改动 → but commit -b <ticket-87 分支> -m "..." <改动id>。不 push、不开 PR（待用户明令）。
