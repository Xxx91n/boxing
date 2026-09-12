# Next-round 常驻任务书 — Wave8 实施 / 发行收口

> 生成: 2026-09-12 · 上游: decision-ledger.md D-001..D-008 · plan.md · destination-reconciliation.md
> 规则: 下一轮 Agent **以本文件 + plan.md 为任务入口**；结论冲突须 revised+新 D-xxx 呈报用户，禁止静默改向
> 版本控制: 唯一 `but`（GitButler）；不 push / 不 tag / 不开 PR，除非用户明令

## 总目标

在 **不宣称可发行** 前提下推进：G-A 残红治理（T-GA）与 G-B 人工路径 **并行**；锐评重开项 R1–R8 随带宽落地；全门齐备后才 CHANGELOG/README 改口与 tag。

## 红线（每项任务继承）

1. G-B 完成前 **禁 tag / 禁宣称 2026.9.12 可发行**（D-001/002）
2. **不扩 ADR-0017**；禁 G-D（D-001/006）
3. 零闪现 **不解耦记忆**；不回滚票 60 除非缺陷票证明回归（D-001/006）
4. G-A: N/B 桶 **禁止写豁免**；禁止 2 条 active 豁免折算 ~37 红为绿（D-006）
5. G-B 验收对象 = **2026.9.12 新 build 解包产物**，勿用 `D:/gb-2026.9.13`（D-002）
6. G4/G5 基线 **只用 v2026.9.11**（D-003）
7. 候选包参数 `amo_sign=true` `make_release=false`（D-004）
8. R8 卫生 **禁止**升发行门禁（D-007/008）

## 已就绪证据（勿重做）

| 项 | 值 |
|---|---|
| 候选 build | run **34689649760** success（version=2026.9.12） |
| G-A 调查 run | **34686760142**（failure 全红） |
| 豁免基线对照 | **34626507101** |
| 分桶报告 | `.scratch/wave8-release-grill/atomcode-ga-residual-research.md` |
| 闪现修复 | commit `898119eb`（`ntp/boot-theme.js`）已在 main |
| 上一发行版 | GitHub Release Latest **v2026.9.11** |

---

## 任务列表（每项声明覆盖 D-xxx）

### T1 — P-GA1 集合差与根因定谳
- **覆盖**: D-006（协议见 D-005 已满足）
- **输入**: logs of 34626507101 vs 34686760142；research H1–H4
- **输出**: 分桶终表 + 根因结论（写入 reports/）
- **DoD**: 能指出 N/B 增量来源；H1 是否成立有证据
- **suggested skills**: `diagnosing-bugs` · `research`

### T2 — P-GA2 N 桶修绿
- **覆盖**: D-006
- **范围**: data-golden gate4 · state-sync 并发 · dr-export WebDAV（建议含 AC1/AC2）
- **DoD**: 对应用例绿或书面退役；**无豁免行**
- **suggested skills**: `tdd` · `implement` · `diagnosing-bugs`

### T3 — P-GA3 B 桶 broken 修绿
- **覆盖**: D-006
- **范围**: conn-delete×4 · innerclip · search · zoom-arrow · Bug5-dark 回归 · star-sync 等
- **DoD**: broken 面绿；不写入豁免台账
- **suggested skills**: `tdd` · `implement`

### T4 — P-GA4 boot-pending × e2e（仅当 H1 成立）
- **覆盖**: D-006
- **约束**: **不回滚零闪现**；对齐就绪等待或 unmask 时序
- **suggested skills**: `diagnosing-bugs` · `tdd`

### T5 — P-GA5 既有豁免复查
- **覆盖**: D-006
- **范围**: auto-expand / zoom-dblclick 两条 active 到期与签名
- **suggested skills**: `code-review`

### T6 — P-REL0 下载 2026.9.12 工件
- **覆盖**: D-004 / D-002
- **动作**: `gh run download 34689649760 -n boxing-release-ubuntu-latest` → 固定目录（新路径，非 gb-2026.9.13）
- **DoD**: sha256 入 evidence；解包目录就绪供 P-HUM2
- **suggested skills**: （无特殊；shell 即可）

### T7 — P-HUM2 G-B 六项（**用户实机**，Agent 只备卡/检证）
- **覆盖**: D-001 / D-002 / D-003 / D-008
- **范围**: G1–G6 双浏览器；基线 v2026.9.11；执行卡见 evidence/49-g-b-manual-golden-path
- **禁止**: 纯自动化宣称 G-B（A-009）
- **suggested skills**: （人工；复核用 `code-review`）

### T8 — P-HUM1 60 慢放证据
- **覆盖**: D-008（B41）
- **suggested skills**: （人工录屏）

### T9 — P-HUM3 #9 close
- **覆盖**: D-008；绑 T7 完成
- **约束**: 完成前只更新不关闭
- **suggested skills**: `triage`

### T10 — P-R1 冲突副本读取口
- **覆盖**: D-007
- **范围**: 列表 + 单条导出 JSON（settings 数据区）
- **suggested skills**: `implement` · `tdd`

### T11 — P-R2 merge 质量方案票
- **覆盖**: D-007
- **约束**: 先方案后实施；勿静默改 newer-wins 语义
- **suggested skills**: `research` · `to-spec`

### T12 — P-R3 CRED per-install key
- **覆盖**: D-007
- **约束**: 含迁移/备份兼容；不做 passphrase 真加密重设计（Wave7 负向仍有效除非新 D）
- **suggested skills**: `implement` · `tdd`

### T13 — P-R4 WebDAV 私网 opt-in
- **覆盖**: D-007（并入旧 B47）
- **范围**: 设置项 + i18n 14 locale + README Privacy
- **suggested skills**: `implement` · `tdd`

### T14 — P-R5 搜索 debounce（性能第一批）
- **覆盖**: D-007
- **约束**: 全量 render 重建维持 ADR-0013 Q3=B
- **suggested skills**: `implement` · `codebase-design`

### T15 — P-R6 popup/ 纳入
- **覆盖**: D-007（重开 A-022）
- **suggested skills**: `implement`

### T16 — P-R7 文档产品化
- **覆盖**: D-007（重开 A-023）
- **约束**: 不阻塞 G-A/G-B
- **suggested skills**: `writing-for-agents`

### T17 — P-R8 票务卫生
- **覆盖**: D-007 / D-008（B40+B44）
- **范围**: 补勾 61/63/64/66 等 issue AC；**禁止**升门禁
- **suggested skills**: `triage`

---

## 建议调度

- **并行**: T7（用户）∥ T1–T3；T6 可立即做
- **串行**: T1 → T2 → T3 →（H1）T4 → T5
- **带宽余力**: T10 → T11/T12/T13 → T14–T17
- **发行末闸**: 全绿/合法退役 + G-B 证据 + G-C 复查 → CHANGELOG/README → tag → T9

## Suggested skills（下轮加载）

| 场景 | Skill |
|---|---|
| 修测试/实现 | `tdd` · `implement` |
| 根因 | `diagnosing-bugs` |
| 调研 | `research`（或 atomcode 协议见 D-005） |
| 复核 | `code-review` |
| 立票/分诊 | `triage` · `to-spec` · `to-tickets` |
| 架构方案 | `codebase-design` · `domain-modeling` |
| 版本控制 | `but` / GitButler skill |
| 收尾知识 | `neat-freak` · `handoff` |

## 禁止事项（负向汇总）

- 禁 tag / 禁宣称可发行（直至 G-A∧G-B∧G-C）
- 禁扩门禁 / 禁 G-D / 禁 N-B 豁免
- 禁复用 gb-2026.9.13 作为 2026.9.12 发行 G-B 证据
- 禁把 R8/过程违规变成 release-blocking
- 禁静默 revised 账本
- 禁 `git add/commit/push` 直呼；用 `but`
