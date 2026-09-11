# 45 — CI 数据兼容性门控：golden fixture + 迁移/回滚测试

**What to build:** test/fixtures/schema/ 存放各 schemaVersion golden JSON；新增迁移测试（旧数据→新代码书签不丢）与回滚安全测试（新数据对旧读取约束前向兼容）；接入 pretest 与 CI；失败即红灯。

**Blocked by:** 41

**Status:** done (branch ci/data-golden-gates @ efaeac7; report 45-ci-data-golden-gates-report.md) — gate2 final semantics per 45R: background 禁写 boxingLayout(写调用/key 扫描), 合法读 (t42 COW) 与 snap.v1 等其它 key 的写均放行; 子串 not.toContain 禁用

- [x] 每个历史 schemaVersion 至少一份 golden fixture 入库
- [x] 迁移测试在 npm test / CI 中执行且失败使 job 红
- [x] 回滚安全测试覆盖 expand/contract 假设
- [x] cluster-map 登记新 spec
