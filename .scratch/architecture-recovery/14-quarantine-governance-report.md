# 14 — quarantine 车道治理补强 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-02
- 状态: **done** — issues/14 验收 4/4 勾选; 本文件为收口用完整版
- 分支: `arch-recovery-14-quarantine-governance` (stack 在 ticket-11-render-geometry-downsink 之上, 原因见版本控制轨迹)
- 提交: `vxu` (18 文件单 commit: 12 个 spec + 2 个 config + README + quarantine.yml + issues/14 写回 + WORKFLOW §6 两条教训); 本报告文件补交同分支
- 上游依据: handoffs/14 + issues/14 + spec.md (quarantine 治理: 不引新框架, 只挂引用 + 登记时限 + 独立 CI config) + WORKFLOW §4.2/§6

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| test/tests/*.spec.ts × 12 | +19 行 | 每个 `@quarantine` test 标签上方插入一行 `quarantine-ref` 注释 (focus-steal 3 / v3 3 / webdav 4 / 其余各 1), 指向 issues/14 + 登记日期 + 期限 |
| test/playwright.config.ts + playwright.quarantine.config.ts | +1+1 行 | 两处 @quarantine 说明注释块各补一行 quarantine-ref (handoff 要求 "rg 全部命中一条不漏" 含 config 注释块) |
| README.md | +42 行 | Development 下新增 "Quarantined tests" 小节: 19 行登记表 + 到期规则 |
| .github/workflows/quarantine.yml | 新建 43 行 | 每日定时 quarantine 车道巡逻 job (见下) |
| .scratch/.../issues/14-quarantine-governance.md | 验收 4/4 勾 + 勾稽小节 | Status → done (2026-09-02) |
| .scratch/.../WORKFLOW.md | §6 +2 行 | 票14 两条教训 (见下) |

## 关键裁决与证据

1. **车道现状勘误 (本票最重要的认知修正)**: playwright.config.ts 只有 firefox-extension 项目带 grepInvert; chromium 主车道实际已在跑全部 19 个 @quarantine tag (票01 修复后回归主车道)。治理对象是 firefox 排除面, 不是 chromium。test:quarantine 是 firefox 侧的巡逻/修复车道。
2. **基线 (动工前取)**: 38 运行 (19×2 project), 33 绿 / 5 失败, 5 个失败全部 firefox (adr-0007 Q3b 空间索引 / audit saveLayout localStorage 回退 / debug file:// 全流程 / innerclip y=0 / popup-dragselect)。chromium 19/19 绿。失败均为 playwright#16095 类 firefox 环境隔离原因, 与 README 表格逐行对应。
3. **登记规则**: 全部 19 条 registered 2026-09-02 / due 2026-10-02; 到期规则 = 修复摘标 (去 tag + 去 ref + 删行) 或退役 (删测试 + 删行 + 决议记录), 到期强制裁决默认退役, 不自动续期; 新隔离当日登记 due=+30d。
4. **CI 实现选型**: schedule 触发的是整个 workflow 的所有 job — 往 test.yml 塞 schedule 会连带每日跑三 OS 全量矩阵。故新建独立 quarantine.yml: cron '17 2 * * *' (每日 10:17 北京) + workflow_dispatch, job 级 continue-on-error: true, ubuntu-latest 单机, xvfb-run headed (quarantine config headless:false, runner 无显示), npm ci → playwright install → 车道命令。仓库已有 workflows, 按票面走真 CI job, 无手验项。

## 验证证据

- `npm run test:quarantine` 车道可执行 (基线见上, exit 非零属预期 — 允许已知失败)。
- `npm test`: **409 passed / 10 failed (9.1m)**; 10 个失败按 handoff 完成定义 "满负载抖动超时项单跑必绿" 复验 — 失败 spec 单独重跑 workers=2: firefox 27/27 绿 + chromium 3/3 绿, 全部收敛。10 个失败分布 (accent-theme ×2 / adr-0007 Q1 / i18n-module / innerclip ×2 / memory / onboarding / star-sync ×2) 与本次改动 (纯注释 + 文档 + 新 CI 文件) 无行为交集, 确认负载抖动。
- 插入后 rg 复查 quarantine-ref 计数逐文件核对 (19+2); BOM/CRLF 全清 (LF 红线); README 表格 19 行整。
- 本票无 dist 契约面 (未动 ntp/**/manifest), 未跑 build — 对齐票15 "文档票无需 build" 先例与 WORKFLOW §4.1 (非拆分类票)。

## 版本控制轨迹 (§4.2)

- 开工前 but status: 工作区混有大脑窗工件 (handoffs/prompts/spec/brain-round2) + 票15 窗口在写 + dev junction 改动 — 全部未纳入本票提交。
- **并行冲突处置 (票05 隔离法实证)**: WORKFLOW.md 未提交 delta 里混着票15 窗口新写的一行教训; 处置 = 临时摘除票15行 (备份 temp) → 提交本票 2 行 → 原样还回; 还回后已验证剩余未提交 delta 仅票15 一行, temp 备份已删。
- **stack 依赖 (票10 教训同款)**: 首次 but commit 报 "lines 96–97 depends on ticket-11-render-geometry-downsink (pyn)" (本票 WORKFLOW 行紧跟票11 已提交行之后); 按 Hint 恢复: `but branch new arch-recovery-14-quarantine-governance --anchor ticket-11-render-geometry-downsink` → 重提成功。
- commit `vxu`: 18 文件 = 12 spec + 2 config + README.md + quarantine.yml + issues/14 (untracked 整文件, 含大脑窗基线 — 同票11 报告注意事项) + WORKFLOW.md (仅本票 2 行 delta)。未 push, 未开 PR (§4.2)。

## 给大脑的收口注意

1. **到期裁决排期**: 2026-10-02 全部 19 条同日到期 — 建议大脑窗在 09-末开一张治理票统一裁决 (修复/退役), 不要拖到过期默认退役一次性删 19 条。
2. **修复候选排序建议**: firefox 基线 5 个失败里, adr-0007 Q3b / audit saveLayout / debug file:// 三个是 file:// 或 storage mock 语境 (票03/票10 教训相关), innerclip / dragselect 是原生输入语境 (票01 教训); firefox 14 个绿但被排除的 tag 是低成本修复候选 (摘标前先连跑几轮确认稳定)。
3. **CI job 首跑观察**: quarantine.yml 的 cron 只在默认分支生效 (GitHub 行为), 合入 main 后建议手动 workflow_dispatch 跑一次验证 xvfb-run 车道 (本机无法验证 runner 环境, 已按票面 "无 CI 则记手验项" 的镜像逻辑在此记录该项)。
4. **.scratch README 波次表未动**: 票14 状态仍标 ready-for-agent, 属大脑窗管辖, 本票未越权改 (对齐票11 先例)。
5. **无偏离**: 四项验收 + 两项 delta (基线先行 / rg 全命中) 全部按任务书执行; 唯一裁量是 CI 用独立 workflow 文件而非塞进 test.yml, 依据与影响已记录 (§6 第 2 条教训)。

## WORKFLOW §6 新增教训 (已写回)

- 主 config 只有 firefox 项目带 grepInvert — chromium 主车道实际已在跑全部 @quarantine tag; "挂引用" 要 rg 全部命中含 2 个 config 注释块, 不能只扫 test() 标签。
- CI 每日定时单车道 job: schedule 触发整个 workflow 的所有 job — 新建独立 quarantine.yml (continue-on-error + xvfb-run) 才是干净做法。
