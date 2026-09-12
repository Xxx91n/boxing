# Report — 75 下载 2026.9.12 候选工件（P-REL0）

## 身份

- 票 75 · 覆盖 A-026（D-002/D-004）· handoff blocked: None (can start immediately)
- 入口 prompts/75-rel-artifact-download-2026-9-12.md；必读 9 份已读（启动器 7 份 + handoff 追加 atomcode-ga-residual-research.md、next-round.md；AGENTS.md 常驻上下文）

## 事实源（实测，非推理）

- run 34689649760 = main「Build & Package」（workflow_dispatch, 2026-09-12）：success，windows/ubuntu/macos 3 个 build job 全绿
- 工件 3 个均未过期：boxing-release-ubuntu-latest（id 10296757122，995,058 B）、windows（10296442304，957,034 B）、macos（10296252746，957,404 B）
- 按 next-round T6 指定 lane（boxing-release-ubuntu-latest，内含全部 4 个发行文件）下载到固定新路径 D:/rel-2026.9.12，解包 D:/rel-2026.9.12/chrome 与 D:/rel-2026.9.12/firefox（各 8 顶层条目，manifest.json 在 zip 根即扩展目录本体）
- sha256 ×4 + run URL + artifact id 记入 evidence/75-rel-artifacts/00-artifacts.txt（firefox zip/xpi 字节相同，sha 一致）
- 解包 manifest version=2026.9.12（chrome/firefox 一致）
- 零闪现进本版（D-002）：双浏览器解包树均含 ntp/boot-theme.js（票 60 / 898119eb）
- make_release=false 检查点成立：gh release list 仅 v2026.9.11（Latest）与 v2026.9.9，无 v2026.9.12 release；.github/workflows/build.yml:182 release 步骤确以 github.event.inputs.make_release == 'true' 为门

## 改动（本票 delta）

- 无源码/构建配置改动。仅 tracker 三文件：evidence/75-rel-artifacts/00-artifacts.txt（新建）、reports/75-report.md（本文件）、issues/75（AC 勾选 + status → done）
- 禁令遵守：未 tag、未对外宣称可发行、未动 ADR-0017、未触发 CI、未 push、未动其他窗口改动

## AC 核验（issues/75 三项）

- [x] chrome/firefox 解包就绪 — D:/rel-2026.9.12/{chrome,firefox} 各 8 顶层条目，manifest.json 在根，version=2026.9.12；票 76（G-B 六项）可直接加载本解包产物
- [x] artifacts 含 sha256 与 run URL — evidence/75-rel-artifacts/00-artifacts.txt：sha256 ×4 + run URL + artifact id/archive URL
- [x] 路径入 reports/75-report.md — 本文件「事实源」节 + evidence 记录完整下载/解包路径；专属验收：路径不含 gb-2026.9.13 ✓

## 与旧候选包鉴别（D-002 要求）

- 旧候选 2026.9.13（run 34641377036，解包于 D:/gb-2026.9.13）不含闪现修复（wave7 decision-ledger 明证）；本包 run 34689649760 manifest version=2026.9.12 且双树含 ntp/boot-theme.js。G-B 六项（票 76）验收对象 = 本包（D:/rel-2026.9.12）解包产物，禁复用旧树。

## 验证（命令 + 结果）

- gh run view 34689649760 → ✓ main Build & Package，3 job success
- sha256sum 4 文件 → 见 evidence
- unzip -q -o → chrome/ firefox/；grep '"version"' → 2026.9.12 ×2
- gh release list --limit 5 → 无 v2026.9.12
- grep -n make_release .github/workflows/build.yml → :182 门在

## 完成定义对照（handoff 四条）

- issue AC 全勾 ✓（见上）
- 报告落 reports/75-report.md ✓（本文件）
- 版本控制遵循 WORKFLOW §4.2 ✓（见下）
- 不 tag、不宣称可发行、不扩 ADR-0017 ✓

## 版本控制

WORKFLOW §4.2：but diff 确认 → but commit -b ticket-75-rel-artifact-download（本窗口独立 but branch，仅含本票三文件；未 push）
