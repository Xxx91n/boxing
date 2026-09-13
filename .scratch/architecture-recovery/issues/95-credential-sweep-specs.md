# 95: 凭据清扫 — 存量 spec 真实 WebDAV 账号 env 化

**Covers A-xxx:** A-049

**What to build:** 将仍内嵌真实 WebDAV URL/用户/密码的既有 Playwright spec 与临时副本统一改为 `BOXING_SPEC_WEBDAV_*` env + 占位（与 91R 同构）；不改测试语义。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `grep -R kel988 / jinxi2410 / 真实 koofr 主机` 在 `test/` 与 `.codex-tmp/` 工作树 **0 命中**（历史 commit 不在本票范围）
- [ ] 各 spec 使用 env override + 占位；`--list` 仍可加载
- [ ] 不削弱既有断言；`reports/95-report.md` 落盘
- [ ] 提醒用户：密码仍须轮换（多文件历史已含）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff
- 来源: 91R R4 呈报 + W1 首脑核验
