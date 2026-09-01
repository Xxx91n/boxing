# 架构调研报告 — boxing ntp.js 拆分心智模型

- 生成日期: 2026-08-31
- 生成依据: 两轮 atomcode 联网深度调研(Exa+Tavily+AnySearch, 28+ 检索, 18 篇原文, 含 arXiv 实证 / Fowler 原典 / Chrome 官方文档 / V8 文档 / Vantage 与 Excalidraw 开源案例)。全文存于 ctx 知识库(source: atomcode), 本文件为决策性摘要。

## 结论 1 — ntp.js 拆分裁决: 做, strangler-fig 增量拆分

现状: ntp/ntp.js = 6055 行 / 312KB, 单 IIFE classic script (ntp/index.html:389 `<script src="ntp.js" defer>`), 0 import/export。

顺序铁律(Fowler 系共识): 永不先啃最耦合的主内聚。

1. 波次 1 边缘域: favicon 缓存 (ntp.js 5911-6013 自包含块)、i18n 字典、纯工具函数 — 验证模块流水线。
2. 波次 2 状态收敛: 闭包共享状态 (layout / revision / 抑制标志) 收敛为显式 state 模块 — ESM live binding 下严禁两模块各持副本。
3. 波次 3 存储门面: storageWriteChain 串行写链 + applyingExternalLayout 防回环 + 6 个 storage.onChanged 监听收敛为单一写入门面模块。Chrome 官方定性 storage API 无事务、有竞态; 现状已是官方推荐形态, 拆分的最大风险是把它拆散。
4. 波次 4 持久化层与渲染主内聚 (canvas 渲染 / 布局), 最后动。

关键技术事实:
- 扩展页 (NTP) 支持原生 `<script type="module">`, 与 defer 语义兼容, 平滑替换 (V8/MDN)。
- 裸 ESM 零构建在扩展场景无性能税 (chrome-extension:// 本地加载; Vantage 22-widget MV3 NTP 已验证零构建纯 ESM 模式)。
- 风险点: ntp.js 顶部 file:// mock 在模块模式下因 CORS 失效 — file:// 手工调试路径会断, Playwright 测试(扩展上下文)不受影响。
- 动手前必须用无头脚本扫描全文件调用图: 隐式跨函数依赖是机械搬移阶段最大 ReferenceError 风险。
- package.json 已 `"type": "module"`, 无需改。

## 结论 2 — AGENTS.md 治理: 租法律式规则的实证税

- arXiv:2602.11988 (ETH Zurich, 2026-02): context 文件使推理成本 +20% 以上; 99% 内容是代理本可自行发现的仓库 overview。
- 处方: 薄化 AGENTS.md, 只留不可从仓库推断的约定 (测试命令 / ADR 指针 / SEC 硬规则); 性能反模式类规则 (ADR-0013 系) 移入模块边界 + 测试强制。
- 拆分落地后 BX-DEV/A1-A5 类规则应大面积自然失效 — 失效即成功。

## 结论 3 — flaky test

9 个已知 flaky test 是测试套件可信度的持续放血, 优先级高于任何重构: quarantine + 限期修复或删除, 不再容忍。

## 结论 4 — 产品定位 (第二轮调研)

- 差异点"嵌套空间盒+无限画布"真实 (书签管理被系统性证伪: 文件夹瘫痪 / 视觉上下文丢失; NTP 被动曝光解决"存在即遗忘"; 空间记忆认知依据)。
- 但它是换赛道的差异点, 不是换选手的替代动机; 受众是书签重度整理型用户 (现用 Raindrop/Milanote/start.me), 非颜值党。
- 画布反模式("无结构=不可导航")恰好被嵌套盒子锚定 — 组合设计成立。
- 增长模板: CWS 站内搜索为第一渠道 (40-70% 安装), 长尾关键词空位 + "书签不再失效"一句叙事 + 单 CTA 激活 (60 秒激活窗口); Product Hunt 仅 24-72h 脉冲。
- 本报告定位结论为方向性输入, 不构成本次拆分工作的验收条件。
