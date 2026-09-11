# 49 — G-B 人工 zip 黄金路径 · 证据归档

- 票面: `../../issues/49-g-b-manual-golden-path.md` · handoff: `../../handoffs/49-g-b-manual-golden-path.md`
- 报告: `../../reports/49-g-b-manual-golden-path-report.md`
- 门禁裁决: ADR-0017（三条件合取）· 检查单母本: WORKFLOW §4.4
- **状态: 等待人工执行（ready-for-human）。G-B 未完成——禁止以纯自动化宣称完成（A-009）。**

## 使用流程

1. 候选版本确定后（`.github/workflows/build.yml` workflow_dispatch 产出 `boxing-chrome-<VER>.zip` / `boxing-firefox-<VER>.zip`），将 `checklist-template.md` 复制为两份：
   - `checklist-<VER>-chrome.md`
   - `checklist-<VER>-firefox.md`
2. 按 `gb-execution-card.md` 的操作步骤在真浏览器逐项执行并勾选；每项证据落本目录（浏览器分目录 `chrome/`、`firefox/`）。
3. 勾选完成后回传（commit 本目录，或通知大脑窗口检视）。复核人按 `writeback-draft.md` 的清单逐条验证证据，再写回 GitHub #9 与 ADR-0017。

## 目录树

```
evidence/49-g-b-manual-golden-path/
├── README.md                  ← 本文件：归档规范与回传流程
├── checklist-template.md      ← §4.4 发行检查单母本（复制后勾选）
├── gb-execution-card.md       ← G-B 逐项执行步骤 + 存储验证命令
├── writeback-draft.md         ← 复核清单 + #9 / ADR-0017 写回稿
├── chrome/                    ← Chrome 车道证据（勾选单 + 截图/文本）
└── firefox/                   ← Firefox 车道证据（勾选单 + 截图/文本）
```

## 证据命名规则

- 格式: `<G项>-<摘要>.<png|txt|json>`，G 项编号 G1–G6 对应检查单 G-B 六项（见执行卡）。
- 文本证据（storage dump、console 导出、计数）优先 `.txt`；截图 `.png`；一项多文件加字母后缀（如 `G4-preupdate-index-a.txt`）。
- 勾选单命名 `checklist-<VER>-<browser>.md`，与证据同放对应浏览器目录。

## 复核拒绝条件（完整性底线）

- 任何勾选行没有对应证据文件 → 该行视同未勾。
- 「零 console 错误 / 无冻结」类结论无截图或 console 导出文本 → 拒绝。
- G4（升级）未同时记录上一发行版本号与候选版本号 → 拒绝。
- G5（回滚演练）缺 v2 单程路径样例子项证据 → 拒绝（ADR-0017 具名项）。
- G6 未落具名确认人与确认载体 → 拒绝（禁止无人复核发布）。
