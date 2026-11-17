# 发布门槛报告 — 标题输入框迁移 + 后台自动备份（spec #120 / 票 #131）

> 这份报告回答一个问题：**现在能不能发版？** 能自动跑的都真跑了，跑不了的
> 明说跑不了。**CI 全是绿的不等于 Firefox 过了**——CI 的 Firefox lane 根本没装插件。
>
> 判定只有三档，别混着用：
>
> - ✅ 自动通过：本次真跑过，有命令、退出码和输出。
> - 🟡 人工待做：只能在真浏览器里用鼠标点，写清谁做、怎么判。
> - ⛔ 阻塞：没过就不能发。

## 1. 这次核的是什么

| 项 | 值 |
|---|---|
| 版本 | 2026.11.1 |
| 起始基线 | `946d1ab4cd8a1e2136fd8d7eb955c573f66dedd3`（已含 #121、#122–#130 的全部提交） |
| 构建 | `npm run build` → `dist/boxing-chrome/`、`dist/boxing-firefox/` |
| Chrome 发布 zip | `dist/boxing-chrome/release/chrome/boxing-2026.11.1.zip` |
| Chrome zip sha256 | `eede6e33a6ae99501339ca132134f22b6ccc0eb1fdc403b134b7da1ee940ac79` |
| Firefox 发布 zip | `dist/boxing-firefox/release/firefox/boxing-2026.11.1.zip` |
| Firefox zip sha256 | `fb8d8206bd3fbd72b2e8966938445b969548d2b8271409f6cb77c1704267c96a` |

上面两个 sha256 是**本地这台机器**用它自己的基线构建出来的。发行证据得用**要发的那份
zip** 现算（清单第 0 步写的就是这个），两者不会相等：CI 每次重建，打进包里的时间戳会变。
别拿本地哈希冒充发行哈希。至于"要发的那份"怎么在公开前拿到，见 5.7——那件事还没定。

## 2. 产物里的权限差异（这条是拿真产物查的，不是看源码）

| | Chrome | Firefox |
|---|---|---|
| `host_permissions` | 空 | `https://*/*` |
| `optional_host_permissions` | `https://*/*` | 无 |
| 后台 | `background.service_worker` | `background.scripts` + `type: module` |
| `notifications` | 没有 | 没有 |

这跟 spec D5 说的完全一致：Chrome 走可选授权，Firefox 用它自己的主机权限模型。

## 3. 每一项需求对应哪张票、哪条证据

票号后面是合并进 main 的提交。

| spec 项 | 要保证的事 | 实施票 | 证据 |
|---|---|---|---|
| D1 / T2 | 三处标题改成原生输入框，首点全选、第二下点哪落哪 | #121 `df39175` | `boxing-title-select-all.spec.ts`（含真构建用例）✅ |
| D2 | 自动备份由后台独占执行，NTP 只是看板 | #124 `999a978` | `boxing-bg-local-auto-backup.spec.ts` ✅<br>`boxing-release-gate-loaded-build.spec.ts` 用例 2 ✅ |
| D3 | 默认关闭，开了才开始；周期最短 1 小时；重启只补一次 | #124 `999a978` | `boxing-bg-local-auto-backup.spec.ts`、`boxing-bg-auto-backup-retry.spec.ts` ✅ |
| D4 | 远端不认识就不覆盖；首次创建和已有目标更新都走条件写 | #125 `061271c`、#126 `9f4f2a0`、#127 `a5a2ed3`、#128 `e420ea7` | `boxing-webdav-auto-backup.spec.ts`、`boxing-gist-first-create.spec.ts`（受控 WebDAV 服务）✅<br>Gist 已有备份自动更新：不做，见第 5 节 |
| D5 | 缺权限不外发、不弹框、不越权；产物权限按浏览器分开 | #123 `4ab5252` | `boxing-webdav-permission.spec.ts`：真产物 manifest 断言 + 真实 Chrome 构建里「未授权 origin 被拒」的运行时用例 ✅<br>新 spec 用例 1 再在运行期查一次 manifest ✅ |
| D6 | 最多再试 3 次（约 5/15/60 分钟）、关掉立刻停、结果不许糊弄 | #129 `c0e913b`、#130 `946d1ab` | `boxing-webdav-auto-backup.spec.ts`、`boxing-bg-auto-backup-retry.spec.ts` ✅<br>新 spec 用例 2 验证"关掉即清 alarm、记 cancelled、旧成功时间还在" ✅ |
| D7 | 备份、快照、导出、日志里不许出现凭据或别的标签页数据 | #122 `d1f18e5` | `boxing-backup-credential-allowlist.spec.ts` ✅ |
| T1 | 用真用户能看到的东西做判据，不删老断言 | 全部 | 老 spec 全量跑过（第 4 节），新 spec 只加不减 ✅ |
| T3（demo 边界） | Pages demo 里不许有真正的后台自动外发 | 既有构建 | `build-demo.mjs` 只打 NTP 静态面，包里没有 `background.js`；demo 的 `chrome.alarms` 是空实现，自动备份退回页面内 `setInterval`；demo 行为用例在全量里全过 ✅ |
| T3 | 自动备份整套验收 | #124–#130 | 上面 D2–D7 的 spec + Firefox 清单第 7 节 🟡 |
| T4 | 验证命令 | 本票 | 第 6 节列了实际跑的每一条 ✅ |
| T5 | 发布阻塞门槛 | 本票 | 第 5 节逐条对过 |

## 4. 本次实际跑了什么

真跑，不是"设计上应该能过"。

- Node 24.22.1（仓库 `.nvmrc` 钉死的版本；本机原来只有 24.18.0，低于 `engines` 要求，
  `engine-strict=true` 会直接拒装，所以另装了一份）。
- `npm ci`：退出码 0。
- `npm run build`：退出码 0，两个 dist 都出来了，末尾打印 `DONE_BUILD`。
- `pretest` 那串守卫（import-graph、layout-bypass、migration-golden、css-balance、
  contrast、calver、onboarding、fontsize、site-constants、manifest-contract、
  security-contract、workflow-input、i18n-ratchet、mutex-verify）：全过，0 条 violation。
  calver 有一条"文档里提到旧版本号"的警告，本来就不阻断。
- 全量 Playwright（两个 project）：结果见下面的证据块。最后这次是 `--workers=1`
  跑的——原因见 4.1，不是为了让数字好看。CI 仍按配置用 2 worker 加失败重试。

## Test evidence — 2026-11-17 03:30Z

| field | value |
|---|---|
| git HEAD | `6f98ff44b34be0909b9d391db53166b16b477209 (dirty)` |
| playwright args | `--workers=1` |
| duration | 52.8 min |
| workers | 1 (arg) |

| project | headed | passed | failed | skipped | flaky |
|---|---|---|---|---|---|
| firefox-extension | headless | 692 | 0 | 16 | 0 |
| chromium-extension | headed (default) | 707 | 0 | 1 | 0 |

### firefox-extension — skipped (16)
- AC1/AC2/AC4/AC8: copy results, diagnostics jump and canvas clicks in the loaded build
- AC1-AC6: runs with zero NTP tabs open, deduplicates concurrent catch-ups, cleans up on disable, isolates failures + badge, and rolls back via Time Machine
- Crash recovery: interrupted running state with expired or missing lock and future nextScheduledAt still catches up immediately
- Cross-context serialization: concurrent SW auto-backup and NTP saveSnapshot preserve all snapshots in snap.v1.index and Time Machine
- autoBackupState updates refresh Time Machine snapshots without clearing open conflict comparison panels
- AC-real: an explicit add writes through the real chrome.storage.local and renders
- AC-real: compare and adopt inside the loaded extension write to real chrome.storage.local
- gate 3: undici keep-alive reuse across two syncs
- stored pixels paint as a data URI in a new process with the network gone
- shipped build with optional host permission pauses without any GitHub request
- pre-granted test build creates exactly one Gist through the real service worker
- a fresh install ships the optional-permission boundary and uploads nothing by itself
- the real alarm still writes a snapshot with every extension page closed, and the off switch stops it
- AC-real: first paint, live OS following, the three-state control, quick toggle and the persisted preference in dist/boxing-chrome
- first click selects all, second click places the caret, Enter saves, reload keeps it
- AC-real: SW rejects ungranted HTTPS origin with needPermission, blocks private host, and boot catch-up writes webdavPendingPermission + surfaces banner

### chromium-extension — skipped (1)
- gate 3: undici keep-alive reuse across two syncs

跳过的 17 条是这么来的，别一笔带过：

- Firefox lane 的 16 条 = **15 条**「只跑真实 Chrome 构建」的用例（那个 lane 没装插件，
  跑了也没意义）+ **1 条** `boxing-data-golden.spec.ts` 的 `gate 3: undici keep-alive`；
- Chromium lane 的 1 条 = 就是那条 `gate 3`，它在两个 lane 都跳。

`gate 3` 是 #45 验收时写明的显式跳过：WebDAV/Gist 走的是浏览器 fetch（MV3 网络栈），
Node 侧根本看不到 undici 的连接池，Playwright 也没法从 Resource Timing 观察。
它不是这次新加的；这次新加的两条跳过都是 lane 守卫（上面那 15 条里就有它们）。

（上面这块是 `scripts/test-evidence.mjs` 原样吐出来的，不是手抄。这个脚本这回栽在
`spawnSync` 的 30 分钟硬超时上：全量要跑 60 分钟，父进程先死了，Playwright 孙子进程
还在往下跑，于是每次都判成「报告不存在」。顺带还暴露了两处——workers 标签写死
`4 (local)` 而配置是 2；读到半截 JSON 会直接抛异常，把原本该透传的退出码也丢了。
三处都在本票修掉了。块里的 HEAD 还是提交前的 `6f98ff4`、带 `(dirty)`，因为它是改动
全部落盘、还没 commit 时跑的；提交后以 `git log` 为准。）

真构建专项（单独再跑一遍，方便直接看结论）：

```
npx playwright test --config=test/playwright.config.ts \
  test/tests/boxing-release-gate-loaded-build.spec.ts --project=chromium-extension
  2 passed (约 20 秒)
npx playwright test --config=test/playwright.config.ts \
  test/tests/boxing-release-gate-loaded-build.spec.ts --project=firefox-extension
  2 skipped
```

第二条的 skipped 是设计如此：Firefox lane 没装插件，这个文件在它上面没有意义。
**别把这两条 skipped 读成"Firefox 也过了"。**

### 4.1 跑的过程中出过的问题（不藏着）

同一天跑了五遍。第 5 遍是审查改完之后重跑的，所以数值和第 4 遍不完全一样（测试条数
一样，耗时不同）。为什么跑五遍，见下：

| 遍 | worker | 结果 | 备注 |
|---|---|---|---|
| 1 | 2 | 1398 passed / 1 failed / 17 skipped | 失败：连线的「跨标签星标」。单独重跑 7.7 秒通过 |
| 2 | 2 | 1396 passed / 3 failed / 17 skipped | 又多了 Time Machine 取消、状态并发两条；6 条失败全量重跑全过 |
| 3 | 2 | 1394 passed / 5 failed / 17 skipped | 其中一条是**本票新用例**：Windows 上关浏览器后立刻删临时 profile 报 EPERM；另外几条是 timeout |
| 4 | 1 | 1399 passed / 0 failed / 17 skipped | 63.7 分钟，全绿 |
| 5 | 1 | **1399 passed / 0 failed / 17 skipped** | 审查改完后重跑，52.8 分钟；**上面那块证据就来自这一遍** |

第 5 遍之后，审查又要求补两条：用例 1 加「产物版本必须等于本仓 `package.json`」（版本号
对不上的旧 dist 直接红，但挡不住同版本旧产物，那种只能靠 CI 每次从头 build），用例 2 在
测关闭之前先确认周期 alarm 真的恢复了（否则"关掉后没有 alarm"可能只是因为压根没恢复）。
两条都不改变用例条数，单独复跑（chromium 2 passed、firefox 2 skipped）通过；
**没有为它们再整跑一遍全量**，这里如实写明。

第三遍那条 EPERM 是真问题，虽然是测试自己的毛病：`fs.rmSync` 没等浏览器松开目录。
已经改成带重试的清理，并且清理失败不再让用例变红（临时目录本来就该由系统回收）。
修完复跑通过。

其余几次失败全是 2 worker 在台式机上抢 CPU：Firefox 那边 15/20 秒的用例超时，Chromium
那边 60/120 秒的用例超时，全是 timeout，没有一条断言失败。这批超时跟仓库 issue #36
记录的老毛病是同一个（这机器开着别的桌面程序）。所以最后一遍降到 1 worker，才拿到
一张干净的表。

**这不算"把问题藏起来"**：要真是产品问题，单 worker 也过不去；反过来，只跑单
worker 就当作 CI 也能过，那是自欺。CI 上是 2 worker 加 `retries: 2`，抖动靠重试收敛，
跟本地单跑不是一回事。

## 5. 老实说，哪些还没证明

### 5.1 Gist 已有备份的自动更新——产品决定不做，不算阻塞

票面原来写着"必须有真 API 竞争写入证据，缺了就阻塞"。这条已经在 #128 被更新了：
GitHub 的官方 API 描述里，Gist PATCH 没有任何条件写参数；真刀真枪的竞态也没在这台
机器上跑过（没有可用的测试账号）。所以**自动更新整个不做**，自动路径遇到已有 Gist
直接停（`gistUpdateNotEnabled`），后台一个 PATCH 都不发。决定和当时看过的材料都记在
`docs/gist-conditional-write.md` 里。

注意措辞：不是"已经证明 PATCH 不安全"，而是"官方没记录这个能力、我们也没实测过"。
正因为证不了，才不做。别哪天把它当成"已证事实"引用。

所以现在这一项**不是**发布阻塞。真要哪天重开这个功能，门槛原样还在：得用真
GitHub 测试账号把"读旧版 → 别人改 → 带旧条件写 → 被拒且对方内容还在"这四步跑完，
再把请求 ID、时间和用的头一起记下来。这条写在同文档的"如果将来又要做"一节。

### 5.2 可选主机权限的"真人点一下"

Chrome 的可选主机权限，自动化点不出来——必须有人真点那个授权框。所以
`boxing-webdav-auto-backup.spec.ts` 用受控的 WebDAV 服务验条件写，权限那一段只断言
"缺权限时后台写待授权状态、一个请求都不发"。真人授权这条走清单第 7 节的权限那一步。

### 5.3 真实 WebDAV 服务器

条件写这块（强 ETag + `If-Match`、首次创建 `If-None-Match: *`、GET 到 PUT 之间有人
插进来、服务器不认条件头就停）是在受控服务上验的，服务端**真的**按 RFC 4918 判条件，
不是"返回个 200 就算过"。但不同的网盘实现千奇百怪，发行前用你自己的测试服务器走
一遍清单第 7 节的"远端有别人的东西就不覆盖"。

### 5.4 Firefox：全部是人工

CI 的 Firefox lane 跑的是 `file://`，那里没有后台、没有 alarm、没有真实权限。
Firefox 的结论只能来自：

- 清单第 0 节（三处标题）
- 清单第 7 节（后台 alarm、权限、云端故障、重启补做）

两条都做完、都绿，才算 Firefox 有证据。记录里要写版本号、zip sha256、浏览器版本、
执行人和日期。

### 5.5 🟡 老用户的自动备份设置怎么迁——还没人拍板

spec D3 说得很清楚：老配置不能直接当成"用户同意后台上传"，但也**不许**擅自重置。
现在的做法是安全下限：不删老配置，不默认开，没有可核实的主动开启记录就不启动后台
云端写入。具体怎么迁（比如老 `autoBackupInterval` 到底算不算数）用户还没单独拍板，
所以：

- 本票**不改**任何老配置，也不替用户开；
- 发行说明里不要写"老用户会自动备份"这类话；
- 这一条在发行前需要有发布权限的人明确表个态。**没表态就不许把它写成已完成。**

### 5.6 会话里没做的事

- 没有推送、没有开 PR、没有合并、没有部署（本票授权范围只到本地提交）。
- 没有在真 Firefox 里点过任何一步（5.4），所以本报告**不**宣称 Firefox 已通过。
- 没有跑真正的商店上传流程。

### 5.7 🟡 验收的字节和发布的字节，可能不是同一份

现在的发版命令是 `gh workflow run build.yml -f make_release=true`：**一次 run 里建包，
顺手就把 Release 公开了**（`draft: false`）。于是卡住：

- 用 Release 里的 zip 验收 → 验收发生在**公开之后**，验出问题只能下架重发；
- 用 build 工件验收 → 工件来自另一次 `make_release=false` 的 run，CI 重打包后哈希不同，
  验的就不是要发的那一份。

本票没有擅自改 workflow（那属于发布流程变更，得你拍板）。三条出路：

1. **Release 先 draft，验完再 publish**。要改 `build.yml` 加一个 draft 开关，还要确认
   `demo-deploy` 不会在 draft 阶段被提前派发。
2. **接受"公开后验收"**，验出问题立刻下架。风险自担。
3. **拆成两段**：先构建出工件 → 人验 → 发布会把同一份工件传上去。要改 workflow 的产物传递。

拍板之前，本报告的立场只有一条：**记录里必须写清"验的是哪次 run 的哪份 zip、sha256 是
多少、验收发生在公开前还是公开后"**；不许拿本地重建的哈希冒充发行哈希。

## 6. 自己复现一遍

```bash
# 1. 环境（版本必须是这个，低一点 npm ci 都过不去）
node --version    # v24.22.1
npm ci

# 2. 构建两套产物
npm run build

# 3. 守卫 + 全量测试
npm test

# 4. 全量跑 + 机器证据块。上面那块就是这条命令的 stdout（test-results/ 不进库）。
#    不加 --workers=1 时本机会抖，且块里的 workers 会变成 2 (config)；要一模一样就照抄
node scripts/test-evidence.mjs -- --workers=1

# 5. 只跑真构建的发布门槛用例
npx playwright test --config=test/playwright.config.ts \
  test/tests/boxing-release-gate-loaded-build.spec.ts --project=chromium-extension
```

## 7. 一句话结论

Chrome 这边，能自动验的都验了，全绿；票面原来说的 Gist 门槛按 #128 的决定不成立，
不阻塞。**Firefox 必须有真人把清单第 0 节和第 7 节走完**；再加上 5.5 那个老配置迁移要
有人表态、5.7 那个"验哪份 zip"的流程要有人拍板——这几件没落地，就别宣布"整个需求做完、
可以发版"。