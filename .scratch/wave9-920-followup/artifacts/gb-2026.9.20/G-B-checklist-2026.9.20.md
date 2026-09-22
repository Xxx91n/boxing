# 发行检查单 — 2026.9.20（G-B 重签用 · plan-05）

> 生成: 2026-09-22 · 模板来源: WORKFLOW §4.4 · Owner: **用户实机**（agent 只备包，不代签）
> 产物: `.scratch/wave9-920-followup/artifacts/gb-2026.9.20/`
> 上一发行基线（G4/G5）: **v2026.9.15**（store latest 2026.9.12 / GitHub Release 见 release-status）

## 产物 sha256

| 文件 | 字节 | sha256 |
|---|---:|---|
| boxing-2026.9.20.zip (chrome) | 1022648 | `380e225ff52a232e8e9f2cb2b10c284c8436c1773aba8c08e168770f82e0ce95` |
| boxing-2026.9.20.crx (chrome placeholder) | 1022648 | `380e225ff52a232e8e9f2cb2b10c284c8436c1773aba8c08e168770f82e0ce95` |
| boxing-2026.9.20.zip (firefox) | 1022911 | `608fce5dcad0a38ede91b9db70438065e9db2d34a0659525131a64b700d93605` |
| boxing-2026.9.20.xpi (firefox unsigned dev) | 1022911 | `608fce5dcad0a38ede91b9db70438065e9db2d34a0659525131a64b700d93605` |

注: chrome crx 为 build 占位（与 zip 同字节）；firefox xpi 为未签名 dev 构建（与 zip 同字节）。G-B 请用 **zip 解包产物**。

## G-B 人工 zip 黄金路径（Chrome 与 Firefox 各一遍，用解包产物）

- [ ] 全新安装 → 引导可走完 (Skip/Next), 关闭后主界面可点击, 零 console 错误
- [ ] 建盒/改名/拖拽/缩放 → 重开后数据完整
- [ ] 旧备份导入 → 合并或冲突副本可查, 无静默覆盖
- [ ] 升级安装 (上一发行版 → 新 zip): 首开前 pre-update 快照存在; 迁移后数据完整、无冻结
- [ ] 回滚演练: 新版代码写入后的数据, 用上一版代码读回无损失 (含 v2 单程路径样例 — ADR-0017 具名项)
- [ ] 至少 1 名具发布权限者确认已知风险与回滚预案 (禁止无人复核发布)

## 用户 G-B 声明（重签）

- 版本: __________（应填 **2026.9.20**）
- 日期: __________
- 声明人: __________
- 备注: 2026-09-15 声明 **不覆盖** 本波改码后的新产物（D-004⑤）；须对上述 sha256 产物重签

## 边界

- agent **不代签** G-B（D-002）
- C08 tag/商店归用户
- 三门齐前禁止宣称可发行
