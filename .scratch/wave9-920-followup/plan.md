# Plan — Wave9.20 Followup 实施勾选表

> 唯一顺序来源: decision-ledger.md **D-004**（revised：主序六步不变，C07 终点以 D-005 为准）
> 形态: .scratch 单票（D-006）· Owner 见 D-002

## plan-00 总则

| | |
|---|---|
| 覆盖 D | D-001 D-002 D-006 |
| Owner | agent |
| 完成定义 | 本表其余条目按序勾选完毕且审计链完整 |

- [ ] 范围与责任以 spec §1–§2 为唯一口径
- [ ] 全程不建 GitHub Issue

## plan-01 C05 addBookmark + C07 分层收编

| | |
|---|---|
| 覆盖 D | **D-005**（+ D-004 步骤①） |
| Owner | agent |
| 完成定义 | addBookmark 走 commit；删除类豁免=0；改写豁免有名+到期；计数不升；guard self-test 绿 |

- [ ] addBookmark 收编 mutationHandlers / commit
- [ ] 复核 layout-bypass-guard：LB-1 删除类 0 违规
- [ ] 为保留的改写豁免补到期日/工单路径（D-005②）
- [ ] 不追求 9→0；能收则收（downcounting）
- [ ] 回归：pretest + layout-bypass-guard --self-test

## plan-02 C01 豁免处置

| | |
|---|---|
| 覆盖 D | **D-003**（+ D-004 步骤②） |
| Owner | agent |
| 完成定义 | 3 条 active F 全部 closed（撤账或书面退役）；无续期；waiver-ledger-check exit 0 |

- [ ] empty-state Bug5-dark：以 A-055 已修证据走 105 撤账路径
- [ ] search：同上
- [ ] zoom-dblclick：以票 110 已修证据走 105 撤账路径
- [ ] 任一复发/无已修证据 → 书面退役（禁用或删除+签名存档+理由）
- [ ] 禁止 active+过期等绿；禁止续期

## plan-03 C04 environment 放行

| | |
|---|---|
| 覆盖 D | **D-002**（+ D-004 步骤③） |
| Owner | agent（gh/API；不得顺手 tag） |
| 完成定义 | github-pages deployment policy 允许 v* tag 触发 deploy |

- [ ] 核对 environment github-pages branch/tag policy
- [ ] 放行 v*（或等价 tag 规则）
- [ ] 记录 API 证据到 reports/

## plan-04 G-A

| | |
|---|---|
| 覆盖 D | **D-004 步骤④** |
| Owner | agent |
| 完成定义 | 新 tip test.yml 四 job 全绿 **且** 0 active F |

- [ ] land 后触发/等待 main test.yml
- [ ] 四 job 全绿 run URL 记账
- [ ] waiver-ledger-check + 签名比对

## plan-05 G-B 重签准备

| | |
|---|---|
| 覆盖 D | **D-002 D-004 步骤⑤** |
| Owner | **用户测试声明**；agent 只备包+检查单 |
| 完成定义 | 新 2026.9.20 zip 就绪 + 检查单就绪；用户声明（版本+日期）后 G-B 达成 |

- [ ] 产出 chrome/firefox 发行 zip
- [ ] 附 WORKFLOW §4.4 检查单副本
- [ ] **等待用户重签 G-B**（09-15 声明不覆盖新产物）

## plan-06 G-C

| | |
|---|---|
| 覆盖 D | **D-004 步骤⑥**（含 C03/C06） |
| Owner | agent |
| 完成定义 | 三 URL 200 + version.json==最新 tag + deploy-tail verify |

- [ ] Pages 同步后 pages-gc-verify
- [ ] MISMATCH/UNREACHABLE 两态按检查单处置
- [ ] F-113-01 随 C03 收敛记账

## plan-07 文档账本收口

| | |
|---|---|
| 覆盖 D | **D-001 D-002 D-007** |
| Owner | agent |
| 完成定义 | C09 销账；A-P03 措辞不再暗示三门齐；release-status 口径不误导 9.20；handoff 路径可解析 |

- [ ] C09：确认收口已在 origin/main 后账面 closed
- [ ] A-P03 / release-status 措辞修正（禁止读成三门达成）
- [ ] handoff 脏指针修正（existsSync 核过）
- [ ] 实施完成后一次性回填 release-notes（D-006）

## 主序（硬）

plan-01 → plan-02 → plan-03 → plan-04 → plan-05（等用户）→ plan-06；plan-07 可穿插收尾但不得提前宣称三门。

