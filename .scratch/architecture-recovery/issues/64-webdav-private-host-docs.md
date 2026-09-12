# 64 — WebDAV 私网限制文档化（P2）

**What to build:** 在 README Privacy 写明默认封锁私网/本机 host；不在本票做 opt-in UI。

**Blocked by:** 61 (README 表面)

**Status:** done（票 86 关账 2026-09-12：按本票时点 main@db649204 票面=实测一致，证据 reports/86-report.md；PV-W7-64-1 已处置）

**覆盖 A-xxx:** A-018

- [x] Privacy 节写明私网/localhost 默认拒绝及原因 —— README Privacy 实测：host 清单（localhost/127./10./192.168./169.254 含云元数据/172.16/12/.local/.internal）+ SSRF 式暴露原因
- [x] 不新增设置项（opt-in 后置）—— 本票时点实测「no setting to relax / opt-in deliberately deferred」；opt-in 现由票 82（A-032）另行落地，属后继票 delta，不追溯改写本票票面
- [x] 与 sync-engine/background 实际拦截范围一致 —— 实测 sync-engine.js AUD_PRIVATE_HOST_RE / background.js BG_PRIVATE_HOST_RE+guardWebDAVRequest 在盘；逐 host 对照表见 reports/64；IPv6 去括号缺口以已知缺口在册（reports/64 §已知缺口）
