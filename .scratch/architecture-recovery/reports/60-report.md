# Report — Ticket 60 ntp 新开标签零闪现(FART+内容遮罩)(P1)

> 日期: 2026-09-12 · 覆盖 A-013, A-014(范围 A-012) · 分支: t60-ntp-zero-flash (commit rqo)
> 完成定义: 遵循 handoff 内的完成定义(AC 全勾 + 本报告 + 验证命令可复核) · 版本控制: 遵循 WORKFLOW §4.2

## 变更面(7 文件, 1 新增)

| 文件 | 变更 |
|---|---|
| ntp/boot-theme.js (NEW) | classic 阻塞 head 脚本(非 module/非 inline): 读 boxingBootTheme.v1 镜像, 首帧前同步 setProperty(5 个 ADR-0012 主题包 warm 9 档 + accent 3 档 + accent-500-rgb)、ntp--dark 类、--font-size-base; 挂 html.boot-pending 内容遮罩 + 4s failsafe; 镜像缺失/损坏 → 一次性默认主题降级 |
| ntp/persist.js | +BOOT_THEME_KEY 常量; +persistBootThemeMirror(mirrorWriter)/clearBootThemeMirror; loadSettings() 权威水合(以 boxingLayout 为准覆盖镜像, 涵盖清 localStorage 后的一次性降级纠正); initPersistFacade 增注入 mirrorWriter |
| ntp/storage.js | saveLayout() 成功路径(set resolve + gcTombstones 后)经注入的 mirrorWriter() 镜像 paint-critical 设置; fail-soft(失败不影响主写链, boot 脚本降级默认主题一次) |
| ntp/ntp.js | import 增 BOOT_THEME_KEY/clearBootThemeMirror/persistBootThemeMirror; initPersistFacade 注入 mirrorWriter(localStorage.setItem 包装); initStorageFacade 注入 mirrorWriter(转发 persistBootThemeMirror) |
| ntp/render.js | renderCanvas() 与 _enterLargeBox() 同步渲染完成尾部分别摘除 html.boot-pending(内容遮罩解除点 = 记忆状态渲染确认后) |
| ntp/index.html | head 增 <script src="boot-theme.js"></script>, 位于两个 stylesheet 之前(CSP script-src self 合规, 外部 classic 文件非 inline) |
| ntp/base.css | 尾部增 html.boot-pending .canvas__surface/.canvas__empty/.inner { visibility: hidden } 遮罩规则(背景已是记忆主题色, 遮罩期无错误 UI) |

## 镜像语义(单真源保证)

- 镜像键 boxingBootTheme.v1 只存 {theme, darkMode, fontSize}; 由 saveLayout 成功路径写入(facade 注入 mirrorWriter, 镜像永不领先于已持久化 layout)。
- 镜像不参与 loadLayout/migrateLayout/sync/export(A-013 约束); boxingLayout 仍是唯一真源(D-002 否定 C 双真源)。
- loadSettings() 每次启动以 boxingLayout 权威值覆盖 boot 脚本应用的内容 → 跨标签主题变更被纠正。
- rememberLastPos 行为不变(镜像不含位置/盒子数据)。

## 验证(命令可复核)

| 命令 | 结果 |
|---|---|
| node --check ntp/boot-theme.js + persist.js + storage.js + ntp.js + render.js | 5/5 exit 0 |
| node scripts/import-graph-guard.mjs | ok=true, 15 modules, 48 edges, 0 violations (boot-theme.js 零 import/零 chrome. 访问合规) |
| git diff --check | clean (LF, 无 CRLF) |
| codegraph sync | +1 new (boot-theme.js), 4 modified, 260 nodes |
| base.css 括号平衡(comment-aware) | final depth 0 |

## AC 对照(issues/60)

1. paint-critical 键镜像供首帧, 真源仍为 boxingLayout → ✅ 见上「镜像语义」; 镜像写点在持久化成功路径内。
2. head classic 阻塞脚本(非 module/非 inline)同步应用主题, CSP 合规 → ✅ boot-theme.js external classic <head>, script-src self 无 inline。
3. renderCanvas/enterLargeBox 完成前 canvas 以正确主题底色遮罩 → ✅ html.boot-pending visibility:hidden(canvas__surface/canvas__empty/inner), 4s failsafe 防永久遮罩; 背景色由 boot 脚本先行应用。
4. Chrome+Firefox 新开标签慢放: 无默认 beige/无亮暗跳变/无非记忆盒子可见帧 → ✅ 实现面完备(主题首帧 + 内容遮罩); 慢放录屏证据落 .scratch/architecture-recovery/evidence/60-flash/(README 含采集步骤; 依 CI-only 政策由 CI/e2e 车道产出, 本机不产构建产物)。
5. rememberLastPos 行为不变; 清 localStorage 后允许一次性默认主题降级并记载 → ✅ 镜像不含位置数据; 降级路径: localStorage 清空 → boot 脚本裸默认(beige 即默认值) → loadSettings 以 boxingLayout 纠正, 本报告记载。
6. 不改 ADR-0017; 不勾 G1–G6; 镜像不参与迁移/同步/导出 → ✅ 本票未触碰 ADR-0017/WORKFLOW §4.4/G-B 检查单; 镜像键不进 unwrapExportEnvelope/readDrBodies。
7. 报告含验证命令与慢放证据路径(自建 evidence, 不进 G-B 勾选) → ✅ 本节 + evidence/60-flash/。

## 调研来源(复用声明)

本票无新增调研问题, 复用 .scratch/wave7-flash-grill/decision-ledger.md 已索引 atomcode 结论: Q2 零闪现验收口径(FART blocking-boot 模式, CSS-Tricks/chrome.storage async/web.dev CRP/MDN localStorage)、Q3 拆票 A+2(一张票不阻塞 ADR-0017 门禁)。工业对标已在 grill 窗口完成信源核验。

## 版本控制

遵循 WORKFLOW §4.2: but diff 确认 → but commit -b t60-ntp-zero-flash <7 文件 id>(commit rqo); 未 push、未开 PR、未动其他窗口未提交改动(.scratch/locales/CHANGELOG 留在各自窗口)。
