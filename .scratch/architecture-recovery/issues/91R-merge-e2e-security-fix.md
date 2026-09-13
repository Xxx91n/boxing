# 91R: 返工 — 凭据清除 + e2e 可加载（A-045）

**Covers A-xxx:** A-045

**What to build:** 在保留 merge 产品实现的前提下：①从 `boxing-merge-three-way.spec.ts` **永久移除**真实 WebDAV 用户/密码/服务地址，改为占位或环境变量；②补上 `fileURLToPath` 导入使 Playwright 能 list/load 本文件；③追加写入 `reports/91-report.md` 标注「返工轮次」，不覆盖原记录。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 源文件与工作树中不再出现真实邮箱/密码/真实 DAV 主机（grep 门禁：无 WEBDAV_PASS 明文、无 gmail 真账号）
- [ ] `npx playwright test --list --config=test/playwright.config.ts` 能加载本 spec（不再 ReferenceError）
- [ ] 合并语义/e2e 断言意图不削弱（mock 车道；不依赖真账号）
- [ ] `reports/91-report.md` **追加**「返工轮次 91R」章节（原记录保留）
- [ ] issue/账本状态更新；**不 push** 除非用户明令
- [ ] 提醒：历史 commit 38a2d005 仍含旧字节 → 用户须**轮换密码**；本票不擅自改写他人历史

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff
- 首脑复核: reports/W1-brain-review.md
- 镜像: GitHub #11
