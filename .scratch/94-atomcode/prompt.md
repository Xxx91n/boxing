# Ticket 94 — atomcode 调研 prompt（verbatim）

```
atomcode -p "对比工业界浏览器扩展（Chrome Web Store / Firefox AMO）发版时，版本号推进需要同步哪些版本面与发行说明的单一来源做法，以及发行门禁（CI 绿 + 人工验收 + 页面存活）在新版本号下如何重跑，给出成熟做法推荐"
```

- 载体：`ctx_batch_execute(commands:[{label:"atomcode-94", ...}], concurrency:1, timeout:600000)`（atomcode-research skill 唯一命令；串行一次，开工前 tasklist 探测无在途）
- 结果：exit 0，正常完成；Indexed 12 sections（FTS5 source=`atomcode-94`）
- Sufficiency Gate 自查（atomcode 自述）：searches 6 · angles 5 类全覆盖（Official/Comparative/Criticism/Currency/Community）· full reads 8 · 缺口：Edge/Safari 门禁自动化细节少、AMO 审核时长无最新官方数字、CalVer CI bot 无现成开源实现
- 会话锚定：`atomcode -p "…" --resume d560228e-dd7b-446a-97fe-982dd026d09a`（续跑用）
