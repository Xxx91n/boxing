# Report — 76 G-B 人工黄金路径（用户实机 / P-HUM2）

## 身份

- 票 76 · 覆盖 **A-026, A-027**（next-round T7）· 窗口性质: **ready-for-agent（agent prepares/reviews only）**
- 入口: `prompts/76-gb-manual-golden-path.md` · 阻塞: 75 rel-artifact-download-2026-9-12
- 门禁裁决: ADR-0017（G-A ∧ G-B ∧ G-C 合取）· 版本控制: WORKFLOW §4.2

## 开工第一句（任务书要求）

1. **阻塞 75 是否满足** —— 满足。`issues/75` Status=`done`（2026-09-12，run 34689649760 下载+解包至 `D:/rel-2026.9.12`，sha256 ×4 + run URL 入 `evidence/75-rel-artifacts/00-artifacts.txt`；路径不含 `gb-2026.9.13`，D-002 专属验收成立）。
2. **必读清单是否已读** —— 已读 9 份：启动器 7 份（handoff 76 / issue 76 / spec / WORKFLOW §4.2+§4.4 / decision-ledger Wave8 / destination-reconciliation-wave8 / evidence 49 README）+ handoff 追加的 `atomcode-ga-residual-research.md`、`next-round.md`（T7 段）+ `docs/CONTEXT.md` + AGENTS.md（常驻）。

## 事实源（本窗口实测，非推理）

| 项 | 实测值 |
|---|---|
| 解包树 | `D:/rel-2026.9.12/chrome`（53 文件）、`D:/rel-2026.9.12/firefox`（同构） |
| manifest | chrome=`2026.9.12` / firefox=`2026.9.12` · `manifest_version=3` · name=`__MSG_extensionName__` |
| 零闪现在本版（D-002） | 双树均含 `ntp/boot-theme.js`（票 60 / commit 898119eb）✔ |
| zip 内 `ntp/ntp.css` | 在包内 ✔ |
| G4/G5 基线（D-003） | 上一发行版 = GitHub Release Latest `v2026.9.11` |
| make_release=false | 无 v2026.9.12 release（票 75 已核 `gh release list`）✔ |

## 本票 delta 与改动（仅票据/证据脚手架，无源码改动）

| 文件 | 动作 | 说明 |
|---|---|---|
| `evidence/49-.../chrome/checklist-2026.9.12-chrome.md` | 新建 | 本轮 chrome 车道勾选单：run 34689649760、`D:/rel-2026.9.12/chrome`、基线 v2026.9.11、G1–G6 + 渠道与商店 + 复核区 |
| `evidence/49-.../firefox/checklist-2026.9.12-firefox.md` | 新建 | 同上 firefox 车道；含发布版临时附加组件差异与 Dev Edition/Nightly 建议 |
| `evidence/49-.../{chrome,firefox}/00-artifacts.txt` | 追加 | 2026.9.12 候选块：run URL、artifact id、sha256 ×2/车道、解包路径、manifest 版本、零闪现、G4/G5 基线、泄漏观察；旧 2026.9.13 块标注 superseded 保留追溯 |
| `evidence/49-.../{chrome,firefox}/checklist-2026.9.13-*.md` | 加作废横幅（未删） | D-002 禁止在其上勾选；非破坏性保留 |
| `evidence/49-.../gb-execution-card.md` | 改写对齐 | 标题+票 76 重跑说明；全量 `D:/gb-2026.9.13`→`D:/rel-2026.9.12`、`2026.9.13`→`2026.9.12`、run `34641377036`→`34689649760`；上一发行版预填 v2026.9.11；修正「勿复用 2026.9.12」过时表述 |
| `evidence/49-.../checklist-template.md` | 改写对齐 | 指向 2026.9.12 两份勾选单，声明 2026.9.13 两份作废 |
| `evidence/49-.../writeback-draft.md` | 追加口径 | 票 76 重跑口径；#9 关闭归票 78；代理不得代勾 |
| `evidence/49-.../zip-file-listing.txt` | 重新生成 | 取自 `D:/rel-2026.9.12/chrome` 实解包树，53 条目（原为 2026.9.13 44 条目） |
| `reports/76-report.md` | 新建 | 本文件 |

## 证据复核（对照 evidence/49 README「复核拒绝条件」五条）

| 拒绝条件 | 裁定 | 依据 |
|---|---|---|
| 任何勾选行没有对应证据文件 → 视同未勾 | **当前无任何已勾行**：两份 2026.9.13 勾选单全空，新发 2026.9.12 勾选单亦全空；`chrome/`、`firefox/` 下除 `00-artifacts.txt`、`.gitkeep`、勾选单外 **无任何 G1–G6 证据文件**（无 .png / .txt / .json） | 目录实测 |
| 「零 console 错误 / 无冻结」类结论无截图或 console 导出 → 拒绝 | **无此类结论，亦无证据** → G1/G4 未执行 | 同上 |
| G4 未同时记录上一发行版号与候选版号 → 拒绝 | 新勾选单已把两版本号固化为必填项（v2026.9.11 → 2026.9.12），但**尚无实机填写** | 待用户执行 |
| G5 缺 v2 单程路径样例子项证据 → 拒绝 | **缺**。新勾选单已将 G5b 标为「必查，缺即拒」 | 待用户执行 |
| G6 未落具名确认人与确认载体 → 拒绝 | **缺**。新勾选单已要求确认人 + 载体双填 | 待用户执行 |

**裁定：G-B 未完成。** 按 A-009 / D-001，代理只完成备卡与复核，不代勾、不以自动化宣称 G-B 通过。三门禁合取下，当前发行状态唯一合法表述为 **「不可发行」**。

## AC 核验（issues/76 四项）

| AC | 状态 | 说明 |
|---|---|---|
| 双浏览器 checklist+证据齐 | ☐ 未达成 | 勾选单已备（2026.9.12 双车道），证据待用户实机产生 |
| G4 记录两版本号 | ☐ 未达成 | 勾选单已固化为必填（v2026.9.11 → 2026.9.12），待填 |
| G6 具名确认 | ☐ 未达成 | 待具发布权限者确认并落载体 |
| 禁纯自动化宣称 | ☑ 本窗口遵守 | 未勾任何 G 项、未宣称 G-B 通过、未 tag、未改 ADR-0017 |

票 76 **不关票**：AC 前三项依赖用户实机，属 ready-for-human 阻塞项。

## 红线遵守（next-round 八条 / Wave8 五条）

- ✔ 未 tag、未宣称 2026.9.12 可发行（报告结论=不可发行）
- ✔ 未扩 ADR-0017、未引入 G-D
- ✔ 未动零闪现源码（无源码改动）
- ✔ 未写 G-A 豁免、未触碰台账（G-A 归票 48/70–74）
- ✔ G-B 验收对象 = 2026.9.12 新包 `D:/rel-2026.9.12`，旧 `D:/gb-2026.9.13` 两份勾选单已标作废
- ✔ G4/G5 基线固定 v2026.9.11
- ✔ `amo_sign=true` / `make_release=false`（票 75 已核，本窗口未重触发构建）
- ✔ 未把 .scratch 泄漏升格为发行门禁（仅登记观察项）

## 上报大脑（非本票面，建议另票）

- **发行包混入 `.scratch/` 前缀条目：10 项 / 53 条目**（`build.mjs` 排除清单缺口）。较 2026.9.13（2 项）扩大——本轮泄漏含 `evidence/49-.../chrome/00-artifacts.txt` 等**证据目录自递归**，说明排除规则未覆盖新增路径。影响：发行包含非产品文件（体积/审计面），不影响 G1–G6 功能判定。建议独立票修 `build.mjs` 排除清单并重发候选。

## 完成定义对照（handoff 四条）

- 报告落 `reports/76-report.md` ✔
- 版本控制遵循 WORKFLOW §4.2 ✔（下一节）
- 不 tag、不宣称可发行、不扩 ADR-0017 ✔
- issue AC 全勾 ✖ —— 受 ready-for-human 阻塞，见 AC 核验表；非本窗口可解除

## 版本控制

WORKFLOW §4.2：`but diff` 确认改动 → `but commit -b ticket-76-gb-manual-golden-path -m "..." <改动id...>`；仅含本票文件，不 push、不开 PR、不改写其他窗口提交。

## 下一步（交回用户）

1. 在真 Chrome 与 Firefox 各开独立 profile，装载 `D:/rel-2026.9.12/{chrome,firefox}`，按 `gb-execution-card.md` 走 G1–G6。
2. 证据按 `<G项>-<摘要>.<png|txt|json>` 落在对应浏览器目录，并回填 `checklist-2026.9.12-{chrome,firefox}.md` 的证据行。
3. 回传后由复核人按 `writeback-draft.md` 逐条验证，再走票 78 更新/关闭 #9。
