请做一次联网深度调研（多源检索 + 全文精读），覆盖五类角度：Official / Comparative / Criticism / Currency / Community。

调研问题：
「把静态质量守卫脚本（零依赖 Node 校验器，如 WCAG 对比度 token 校验、import 依赖图守卫、CSS 括号平衡守卫）接入本地开发闭环的最佳工业实践是什么？」

必须回答的 5 个方面：
1. npm 生命周期脚本（pretest / pretest 链）与 pre-commit hook、lint-staged 三者的成熟分工；npm ci + npm test 是否自动跑 pretest？--ignore-scripts 会跳过什么？
2. 把守卫从「仅 CI 显式步骤」下沉到「本地 npm test 自动跑」的收益与失败模式（重复执行、跨平台 shell 差异、Windows 兼容、阻断开发迭代、守卫自身 flaky）。
3. 同一守卫同时存在于 CI 显式步骤与本地 pretest 时，是否应去重？保留单源 vs 双层纵深防御，工业界（Google/Meta/GitLab/GitHub Actions 生态）怎么做？
4. 对零依赖纯 Node ESM 守卫脚本的推荐接入形态与工程纪律（fail-fast 顺序、退出码、--json、与 test runner 的关系、串行 vs 并行）。
5. 反面教训与边界：pretest 被绕过、npm ci 跳过 pre/post 脚本、CI 里 npm test 隐式跑 pretest 造成双跑的实例。

输出格式：
- 结论优先：先给「推荐方案」与理由，再给证据。
- 每条结论附 citation URL（原文链接）。
- 明确区分「官方文档事实」与「社区观点」。
- 最后给一张「推荐 vs 备选」对比表与风险清单。
- 中文输出。