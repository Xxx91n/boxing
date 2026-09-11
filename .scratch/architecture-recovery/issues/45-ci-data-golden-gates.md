# 45 — CI 数据兼容性门控：golden fixture + 迁移/回滚测试

**What to build:** test/fixtures/schema/ 存放各 schemaVersion golden JSON；新增迁移测试（旧数据→新代码书签不丢）与回滚安全测试（新数据对旧读取约束前向兼容）；接入 pretest/CI；失败即红灯。

**Blocked by:** 41

**Status:** ready-for-agent

- [ ] 每个历史 schemaVersion 至少一份 golden fixture 入库
- [ ] 迁移测试在 npm test / CI 中执行且失败使 job 红
- [ ] 回滚安全测试覆盖 expand/contract 假设
- [ ] cluster-map 登记新 spec
