# 回传后复核与写回稿 — 49 G-B

> 本文件仅在用户完成双浏览器勾选并回传证据后执行。A-007：G-B 完成前对 #9 只更新、不关闭。

## 一、复核清单（复核人逐项验证，全过才可写回）

- [ ] `chrome/` 与 `firefox/` 各有一份已勾满 G1–G6 的 `checklist-<VER>-<browser>.md`
- [ ] 每个勾选行有对应证据文件且内容与结论一致（对照 README「复核拒绝条件」）
- [ ] G4 证据显示 `snap.v1.index` 含 pre-update 快照条目，且对应 `snap.v1.<ts>` 正文键存在
- [ ] G5a 旧版代码读回后书签/盒计数不低于新版；G5b v2 单程路径样例证据在案（ADR-0017 具名项）
- [ ] G6 确认人具发布权限，确认载体（issue 评论 / 签署）链接可查
- [ ] G-A 与 G-C 状态已核对（G-A 归票 48，G-C 票 47 已满足；仅 G-B 通过不代表可发行）

## 二、GitHub #9 更新稿（gh issue comment 9 --repo Xxx91n/boxing --body ...）

> G-B 人工 zip 黄金路径：<日期> 由用户在真 Chrome + Firefox 对 <VER> 发行 zip 解包产物按
> WORKFLOW §4.4 检查单完成六项勾选，双浏览器证据归档于
> `.scratch/architecture-recovery/evidence/49-g-b-manual-golden-path/`（commit <sha>）。
> 按 ADR-0017，#9 关闭条件 = G-A + G-B + 证据链齐备（A-007）；G-A 状态见票 48。

## 三、ADR-0017 状态写回稿

- 文件: `docs/adr/0017-release-data-gate.md`，在 Status 或新增「执行记录」行追加：
  `G-B 于 <日期> 以 <VER> 通过（Chrome+Firefox，证据: .scratch/architecture-recovery/evidence/49-g-b-manual-golden-path/）。`
- 若三条件首次齐备 → 同时更新结论为「可发行」并记录可回滚目标版本（CWS/AMO）。
- 若 G-A 仍未满足 → 结论保持「不可发行」，只记 G-B 通过事实。

## 四、票 49 关票

- issue AC 四项全勾 → `issues/49-g-b-manual-golden-path.md` Status 改 done + 报告 §AC 表回填 commit/链接。
- 仅 G-B 通过而 AC3 写回未执行 → 票不关。
