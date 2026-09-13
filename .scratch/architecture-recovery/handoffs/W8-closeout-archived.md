# Handoff — Boxing Wave8 收口 + 2026.9.12 商店/发行（归档）

> 生成: 2026-09-13 · 下一轮用途: 恢复上下文后继续商店提交 / CI 定谳 / 后续版本
> 勿复述本文件已引用路径中的既有条款；版本控制遵循 WORKFLOW §4.2（GitButler `but`）

## 一句话状态

Wave8（票 70–86 + 79R/81R/81R2）已 land 到 origin/main；本地硬验收绿。  
**GitHub Release v2026.9.12 已发布**（用户向中文说明 + chrome/firefox/source zip + SHA256SUMS，无 xpi/crx）。  
**商店正式安装仍是 2026.9.11**（AMO + Edge），**2026.9.12 待你在 Partner Center / AMO 提交审核**。  
G-B 为 D-009 用户强制通过（无证据包）；G-A 以 main CI 为准。

## 必读（入口）

| 主题 | 路径 |
|---|---|
| 硬验收 | `.scratch/architecture-recovery/reports/W8-closeout-hard-acceptance.md` |
| 交叉核对 | `reports/W8-closeout-crosscheck.md` |
| W1–W3 首脑 | `reports/W8-W1|W2|W3-brain-review.md` |
| 账本 | `decision-ledger.md` A-025..A-039 · `../wave8-release-grill/decision-ledger.md` D-001..D-009 |
| 发版计划 | `docs/store-publishing-plan.md` |
| 发布指南 | `docs/publishing-guide.md` |
| 商店文案规范 | `docs/store-assets/STORE-COPY.md` · `descriptions/*.txt` · `LOCALES.md` |
| 发行正文权威 | `docs/release-notes/2026.9.12.md`（CI `body_path`） |
| 门禁 | `docs/adr/0017-release-data-gate.md` · WORKFLOW §4.4 |
| 领域 | `docs/CONTEXT.md` Wave7/Wave8 settle |

## 已就绪

- origin/main 含 Wave8 全量 + 商店文档 + CI Release 修正
- Release: https://github.com/Xxx91n/boxing/releases/tag/v2026.9.12  
  附件: chrome.zip · firefox.zip · source.zip · SHA256SUMS.txt  
- 官方安装链（勿再用 crxsoso）:
  - Firefox: https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/
  - Edge: https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi
- Pages/demo: `demo-deploy.yml` 随 release published 部署；失败时 `gh workflow run demo-deploy.yml`
- 商店描述 14 locale 草稿: `docs/store-assets/descriptions/`

## 本轮教训（下一轮必守）

1. **Release 正文唯一来源** = `docs/release-notes/<ver>.md`；CI 用 `body_path`，禁止 workflow 模板 body 覆盖已发布说明。
2. **Release 附件必须 CI**（`make_release=true`）；禁止本地 `gh release upload` 塞包。
3. **公开文档禁止本机绝对路径**（如 `D:\\...`）；材料用 CI 工件 / `git archive` / `dist/`。
4. Edge 链接必须是 `microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi`。
5. GitHub Release **不发 xpi/crx**；安装引导到商店。
6. `make_release` 仅 ubuntu 腿；发版前先提交 notes 文件。

## 下一轮建议动作

1. **你**：AMO / Edge 上传 2026.9.12（zip + 若需 source zip；文案用 `descriptions/`）
2. 盯 main `test.yml` 定谳 G-A；残红按 N/B 规则（禁豁免 N 桶）
3. backlog: `reports/W8-backlog.md` B50–B57
4. 商店过审后更新 README 徽章/「Latest published」口径（须你确认）
5. 未明令不 tag 额外版本、不宣称「证据齐全 G-B」

## Suggested skills

| 场景 | Skill |
|---|---|
| 版本控制 | GitButler `but` skill |
| 发版/商店 | `docs/publishing-guide.md`（非 skill，主文档） |
| 根因/CI | `diagnosing-bugs` · `research` |
| 实施 | `implement` · `tdd` |
| 复核 | `code-review` |
| 知识收尾 | `neat-freak` · `handoff` |
| 多语言文案 | 对照 `STORE-COPY.md` + `_locales/` |

## 禁止

- 未明令不 force-push / 不改他人历史
- 不把强制 G-B 写成可审计 G-B
- 不扩 ADR-0017 / 禁 G-D
- 不在 workflow 里写死用户向发行说明
