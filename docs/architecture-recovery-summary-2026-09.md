# Architecture Recovery Summary — ntp.js strangler-fig 拆分 (2026-08-31 → 2026-09-01)

全程工件: .scratch/archive/2026-09-architecture-recovery/ (spec / WORKFLOW / 调研 / 调用图 / 10 票 issues+handoffs+prompts / 首脑复核 README)。分支栈: arch-recovery-01..10 + arch-recovery-closure, 合入顺序 01→02→03→05→06→04→07→08→09→10→closure。

## 结果

- ntp.js 6055 行 / 312KB 单 IIFE → 990 行入口编排 + 11 个 ES module (零构建, <script type="module">)。
- 模块图: state/utils/i18n/favicon 为纯叶; storage.js 是全库唯一 storage 写门面 (4 处 layout 写全在门面); persist=布局持久化+主题; render=渲染主内聚 (ADR-0004/0013 优化原样保留); sync-engine/credentials/settings-ui/onboarding = ADR-0016 四层。
- AGENTS.md 28KB→18.6KB: BX-DEV/A1-A5 类规则随结构落成自然失效, commit 逐条点名替代承担者。
- 30 项 flaky test quarantine 修复闭环 (票01)。

## 验证闭环证据 (命令 → 摘要)

- `npm test` × N (各票 + 首脑独立复跑): 411 → 419 全绿区间 (5.4m/6.3m/3.4m 等); 09-02 收口日全套件在本机并行满负载下出现 4-9 项 firefox/双车道超时类抖动, 全部失败项单跑/单车道/提高 timeout 后必绿 — 零功能回归, 纯负载类抖动 (见 backlog #1)。
- `npm run build` DONE_BUILD ×N, dist 双树每票齐模块。
- Node ESM 冒烟: storage 恰 12 导出; state 92 导出 + live binding 实证。
- 存储写面 census: `rg "chrome.storage.*(set|remove|clear)"` 除 storage.js 门面外 ntp/ 零命中; background.js 仅 bgErrLog/boxingInstallSignal 两个 SW 例外 (ADR-0016 记录)。
- 双标签防回环 9/9 (persistent-context 真 onChanged 探针, 票07)。
- 活体探针 chrome-extension:// 9/9 (票10: 凭据信封往返/守卫/信号消费/update 压制)。

## 决策记录

- ADR-0016 (新): sync/backup 四层 + outbox 协议, updatedAt LWW 记为已知妥协。
- 未落: ADR-0017 (value-comparison guard — 票07 实决保留 flag verbatim), ADR-0018 (派生失效+undo)。见 backlog。

## 复用经验 (WORKFLOW §6 全表, 摘录)

- 机械搬移必须用 10 层自验脚本 (marker 唯一性/字节级逆变换对账/括号深度括号跟踪/自由变量审计/回滚快照), 禁手抄。
- facade 注入模式: 跨作用域依赖一次性 init 注入, TDZ 风险归零; 注入点按依赖声明序而非语义位选择。
- 并行同窗同文件改动: hunk 级认领 + 原子 read-modify-write + 前后快照。
- AGENTS.md 薄化收尾三件套: 全文复读 + 全仓规则 ID grep + 内容断言 spec 单跑。
