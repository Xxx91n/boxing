# 14 — quarantine 车道治理补强

**What to build:** 给既有 @quarantine 标签逐条挂 issue 引用 (指向本 scratch issues 编号), 登记 30 天修复/退役时限到 README 状态表, 并在 CI 工作流增加每日定时 job 跑 quarantine 车道 (continue-on-error)。

**Blocked by:** None — can start immediately

**Status:** done (2026-09-02)

- [x] 每个 @quarantine 标签旁有 ticket/issue 引用注释, 可溯源 — 19 处 test 标签 + 2 处 config 注释块均已插入 `quarantine-ref` 一行注释, 指向本票 (issues/14-quarantine-governance.md), rg 复查 quarantine-ref 计数 = 19+2, 无漏
- [x] README 状态表记录每条隔离的登记日期 + 30 天期限; 到期处理规则写明 — README "Quarantined tests" 小节 (Development → Build 之后): 19 行登记表 (每行 registered 2026-09-02 / due 2026-10-02 + chromium/firefox 基线状态), 到期规则 = 修复摘标 或 退役删行, 到期强制裁决默认退役, 新隔离当日登记 due=+30d
- [x] CI 每日定时 quarantine job (continue-on-error: true) — 仓库已有 .github/workflows (test.yml 等), 无需记手验项; 新建 quarantine.yml: schedule cron '17 2 * * *' (每日) + workflow_dispatch, job 级 continue-on-error: true, ubuntu-latest + xvfb-run headed, npm ci → playwright install → quarantine 车道
- [x] npm run test:quarantine 本地可跑通 (允许已知失败, 车道本身必须可执行) — 基线 2026-09-02: 38 运行 (19 tag × 2 project), 33 绿 / 5 失败, 5 个失败全部在 firefox-extension 车道 (adr-0007 Q3b 空间索引 / audit saveLayout localStorage 回退 / debug file:// 全流程 / innerclip y=0 / popup-dragselect), chromium 19/19 绿; 车道可执行, 失败均为已知 firefox 环境隔离原因 (playwright#16095 类)

## 验收勾稽 (ticket 14, 2026-09-02)

- 基线先行 (handoff 要求): 动工前 `npm run test:quarantine` 基线已取得 — 33 绿 / 5 失败 (全 firefox), 证据见上方第 4 条勾稽。
- 挂引用一条不漏: 盘点 rg "@quarantine" test/ 命中 = 19 个 test 标签 + 2 个 config 注释块 (playwright.config.ts 的 firefox grepInvert 说明块、playwright.quarantine.config.ts 的车道说明块), 全部挂 `quarantine-ref`; 插入后 rg 复查计数逐文件核对 (focus-steal 3 / v3 3 / webdav 4 / 其余各 1)。
- npm test 全绿: 见本票完成定义, 结果记录于 WORKFLOW §6 对应行。
- 版本控制: WORKFLOW §4.2, GitButler 分支 arch-recovery-14-quarantine-governance。

## 新增教训 (写回 WORKFLOW §6)

- quarantine 车道现状不是 "chromium 也不跑": playwright.config.ts 只有 firefox-extension 项目带 grepInvert, chromium-extension 主车道实际在跑全部 19 个 tag (票 01 修复后已回归主车道)。治理对象是 firefox 排除面, test:quarantine 是 firefox 侧的巡逻/修复车道 — 基线 5 个 firefox 失败即排除面的已知环境债。
- CI 定时 job 若要 "只跑 quarantine 车道" 且不打扰主 test.yml 的触发面, 新建独立 workflow 文件比往 test.yml 塞 schedule + if 门更干净 (schedule 触发的是整个 workflow 的所有 job)。
