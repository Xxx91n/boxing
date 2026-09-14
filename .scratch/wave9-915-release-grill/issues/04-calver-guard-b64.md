# 04: calver 一致性 pre-commit/CI（B64）

**What to build:** 校验 manifest/package/notes/footer 等版本面一致的门禁脚本，接入 pre-commit 或 CI。

**Blocked by:** None (can start immediately)

**Source:** D-003⑤ · D-006①

**Status:** ready-for-agent

- [ ] 不一致时非零退出
- [ ] 覆盖 manifest version+version_name、package.json、release-notes 文件名
- [ ] 不阻断无关 docs-only 提交策略与仓库约定一致

