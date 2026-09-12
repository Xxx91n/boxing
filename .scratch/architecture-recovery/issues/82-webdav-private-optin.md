# 82: WebDAV 私网 opt-in

**Covers A-xxx:** A-032

**What to build:** 显式信任私网/本机 host 的设置项；默认仍拒；i18n+README 同步。

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-12 · 首脑 AC 卫生补勾 · 源码已核 webdavAllowPrivateHost + 14 locales + README Privacy opt-in · 证据 reports/82-report.md + W8-W1-brain-review)

## Acceptance criteria

- [x] 默认仍拒 — sync-engine/background 双层 PRIVATE_HOST_RE，opt-in!==true 仍拒（W1 实测）
- [x] opt-in 后白名单可用 — settings.webdavAllowPrivateHost===true 放宽；boxing-audit 有 opt-in 断言
- [x] 14 locale 齐 — _locales/*/messages.json 各含 webdavAllowPrivateHost（14/14）
- [x] README Privacy 更新 — 自建 LAN 可 opt-in 表述在盘

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
