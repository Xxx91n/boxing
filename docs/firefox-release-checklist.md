# Firefox 发布前人工核验清单

> 来源：治理决议 #68（B — 声明局限并人工门控）；落地票 #69。
>
> **为什么需要这份清单**：CI 的 `firefox-extension` Playwright 项目不安装插件，所有
> 「实际扩展构建」断言只在 Chromium lane 运行（那些用例在 Firefox lane 上按
> `the loaded build is a chromium lane` 跳过，条数会随票增加，别按老数字记）。
> CI 绿**不构成 Firefox 证据**；
> Firefox 侧实际构建验证由本清单人工承担，纳入发行门禁（见
> `docs/publishing-guide.md`「发版强制规程」）。

## 执行准备

- [ ] **构建与校验**：验收对象是**这一次要上传商店的那份 zip**，不是本地重建的，也不是
      另一次 run 的产物。按当前流程取：
      - Release 已公开 → 下 `boxing-firefox-<ver>.zip` 和 `SHA256SUMS.txt`，核对并记录版本
        号、sha256、Release URL。**这意味着验收发生在公开之后**（见下）。
      - Release 还没公开 → 取**同一次 CI run** 的 build 工件 zip，本地 `sha256sum`，把
        run URL 和哈希一起记进发行票。
      两条都必须落进发行票；解压得到的目录即下文「构建目录」。
      > 验收发生在公开之后是当前流程的既定口径，不是缺陷；写清验的是哪份、sha256 多少、
      > 什么时候验的就行。想挪到公开前验收（draft 发布）属于另一次流程改造。
- [ ] **安装**：按步骤选择加载方式——
      - 第 4 步含**重启核验**：`web-ext run`／`about:debugging` 装的临时扩展重启即被
        卸载；标准发行（`amo_sign=true`）下工件 `.xpi` 未签名，普通发行版 Firefox
        无法持久安装未签名包。按下面两种方式之一执行，并在结果记录里写明所用路径：
        1. **签名豁免的持久安装（推荐）**：Firefox Developer Edition／Nightly／ESR，
           `about:config` 把 `xpinstall.signatures.required` 置 `false`，将上一步
           校验过的 zip（改名 `.xpi`）装入持久 profile——核验的是将要上传的同一
           字节，重启后扩展仍在。
        2. **两个连续 `web-ext run` 会话**（无签名豁免环境时的替代）：共用同一持久
           profile（`--source-dir=<构建目录> --firefox-profile <目录>
           --keep-profile-changes`）。会话 1 触发像素缓存后，先在
           `about:config` 设 `extensions.webextensions.keepStorageOnUninstall=true`
           （可再设 `extensions.webextensions.keepUuidOnUninstall=true`）再完全
           关闭——缺了它临时扩展卸载会清掉 localStorage，会话 2 会以空缓存「假通过」；
           manifest 的固定 gecko id 保证扩展 ID 与存储按同一来源归属。会话 2 断网
           启动后**先在控制台确认 `boxingFaviconPixels.v1` 条目仍在**再判图标。
           该路径验证「新进程＋断网＋持久字节」断言本身，不覆盖 AMO 正式安装形态。
      - 旧版本商店安装（如上一个 listed 版本）只可作非门禁冒烟，**不构成**本次
        zip 的第 4 步证据——它核验的不是当前产物。
- [ ] 打开新标签页（Boxing NTP），**关闭首次运行向导**一次（否则其遮罩会影响操作）。
- [ ] **准备冲突归档种子**（第 1–3 步共用）。手工造一份归档：

  在 NTP 页面的 DevTools Console 执行（页面域，非扩展后台）：

  ```js
  const dbg = window.__boxingDebug;
  const layout = JSON.parse(JSON.stringify(await dbg.storageGet('boxingLayout').then(r => r.boxingLayout)));
  // 挑一个仍存在的书签做字段差异（例：改 title/url），再加一个 id 全新的书签做副本独有项
  const bm = layout.boxes[0].children[0].bookmarks[0];
  bm.title = 'COPY-TITLE'; bm.url = 'https://copy.test/a';
  layout.boxes[0].children[0].bookmarks.push(
    { id: 'copy-only-bm', title: 'COPY-ONLY', url: 'https://copy.test/only' });
  const ts = Date.now();
  await dbg.storageSet({ ['boxingLayout.conflict.' + ts]:
    { ts, reason: 'import-merge', side: 'incoming', raw: { boxes: layout.boxes },
      size: JSON.stringify(layout.boxes).length, boxes: layout.boxes.length } });
  // 合入既有索引，不要整体覆写——否则 profile 中已有的归档行会从冲突列表中消失
  const idxKey = 'boxingLayout.conflict.index';
  const idx = ((await dbg.storageGet(idxKey))[idxKey]) || [];
  idx.push({ ts, reason: 'import-merge', side: 'incoming',
    size: JSON.stringify(layout.boxes).length, boxes: layout.boxes.length, truncated: false });
  await dbg.storageSet({ [idxKey]: idx });
  location.reload();
  ```

  样例最小化自 spec 夹具（`boxing-conflict-field-adjudication.spec.ts` /
  `boxing-conflict-copy-additions.spec.ts`），未新拟数据；id 必须与当前布局中
  仍存在的对象对应，独有项 id 必须为画布中不存在的新值。**全新 profile 的画布
  可能没有书签**——先正常 UI 建一个小盒子加一个书签再执行本段，否则
  `boxes[0].children[0].bookmarks[0]` 不存在。种子只新增归档、不改
  `boxingLayout` 布局本体；建议用**专用测试 profile**执行，避免测试条目留在
  日常使用 profile 的冲突列表里。

## 核验步骤（每步对应既有 spec 的头条断言）

### 0. 三处盒子标题可编辑（#121 / spec #120 T1）

来源断言：`boxing-title-select-all.spec.ts` 的
`large title: first real click selects everything…`、`…second real click collapses the
selection and puts the caret where it landed`、`inner-page title: … Enter saves once`、
`paste is plain text…`、`an empty title falls back to that box type localized default name`。
Chrome 侧由该 spec 的 `Ticket 121 - title inputs in the loaded Chrome build` 用例在真实
构建里承担；Firefox 侧在本清单人工执行。

- [ ] 新建一个大盒子：**第一次真实点击**标题 → 整名被选中；直接输入即整体替换。
- [ ] **第二次真实点击**标题中间某个字 → 选区收起、光标落在点到的位置（不是首/尾）；
      能插入与删除该处文字，标题栏空白处拖动仍移动整个盒子，标题文字拖动不移动盒子。
- [ ] 回车提交；Esc 取消（随后的失焦不把取消的内容写回）；点别处（失焦）也会提交。
- [ ] 中文输入法：选字时按回车只上屏、不提交；上屏后回车才提交。
- [ ] 从网页复制带换行的富文本粘贴：只留纯文字，换行变成空格，首尾空白被去掉；
      清空标题后保存，大盒子与盒内顶部显示「未命名盒子」，小盒子显示「新建小盒子」（本步骤使用简体中文界面；英文界面分别为「Untitled box」和「New small box」）。
- [ ] 进入大盒子：盒内顶部标题同样首点全选、次点定位、回车保存、Esc 取消；
      小盒子标题同上，超长标题在未聚焦时显示省略号，编辑时能看到全部内容。
- [ ] 刷新页面：上述标题内容全部保留。

### 1. 冲突比较与逐字段应用（#54）

来源断言：`boxing-conflict-field-adjudication.spec.ts` 的
`AC-real: compare and adopt inside the loaded extension write to real chrome.storage.local`。

- [ ] 「设置 → 数据 → 冲突副本」列表点该行「比较」：同一面板内展示差异行，
      **默认全部「保留当前」**；行内只有用户可编辑字段可选，无内部 ID/计数器可改。
- [ ] 把种子书签的那个差异字段切到「采用副本」→「应用」：画布立即更新该字段；
      其他盒子、书签、设置不变（对照画布与存储）。
- [ ] **原 conflict copy 应用后仍在列表中**（不自动删除）。

### 2. 显式补入副本独有项（#55）

来源断言：`boxing-conflict-copy-additions.spec.ts` 的
`AC-real: an explicit add writes through the real chrome.storage.local and renders`。

- [ ] 同一条比较面板中，副本独有的 `COPY-ONLY` 书签显示为可勾选的补入行。
- [ ] 勾选它 → 应用：该书签出现在对应小盒子中；当前已有内容原样保留，
      未被勾选的内容不改变。

### 3. 安全删除与单独恢复（#56）

来源断言：`boxing-conflict-copy-safe-delete.spec.ts` 的头条 AC1+AC2+AC3+AC4
（该票只交付 file:// lane 并如实声明；此步把同断言人工落到实际构建）。

- [ ] 该条目「删除」触发**二次确认**；确认后先从列表中消失（保存原文安全副本在前）。
- [ ] 「设置 → 数据」的归档安全副本区（`#data-conflict-guard-list`）出现对应条目，
      点其「恢复」：**原 conflict copy 回到冲突列表**，画布不回滚、其他工作不变。
- [ ] 失败面（安全保存失败不删、容量拒绝、恢复不回滚布局快照）由
      `boxing-conflict-copy-safe-delete.spec.ts` 的 file:// lane 在 CI 覆盖，
      不在本清单重复人工执行。

### 4. 图标像素缓存离线回退（#58）

来源断言：`boxing-favicon-pixel-cache.spec.ts` 的
`stored pixels paint as a data URI in a new process with the network gone`
与 `built manifests keep the existing authorization boundary`。

- [ ] 在有书签的画布上让图标加载一次；在 NTP 页面 DevTools Console 核对
      `localStorage` 的 `boxingFaviconPixels.v1` 是否出现该域的持久条目。
      **未捕获不算失败**：#58 AC8/D5 为尽力而为，授权不可读的来源应原样回退
      URL 显示，不索取新权限；manifest 权限不得为此扩大。
- [ ] 若出现条目：按所用安装方式进入**新进程＋断网**——签名豁免安装则完全关闭
      Firefox 后断网重开同一 profile；双 `web-ext` 会话则关闭后断网重跑
      `web-ext run` 到同一 profile（先确认 `boxingFaviconPixels.v1` 条目仍在）。
      打开 NTP：该图标仍显示（src 为 `data:image/png;base64,`，可点开看属性），
      不是空白。
- [ ] 检查 manifest（`<构建目录>/manifest.json`，即当前 ZIP 的解压目录）：未因像素层
      新增权限。

### 5. 关于页便捷入口与非模态速查（#59）

来源断言：`boxing-about-quick-entries.spec.ts` 的
`AC1/AC2/AC4/AC8: copy results, diagnostics jump and canvas clicks in the loaded build`。

- [ ] 「设置 → 关于」：复制版本号按钮把 `manifest.json` 的 `version_name`/`version`
      写入剪贴板；每个既有项目链接的复制按钮写入对应 URL。
- [ ] 「打开诊断」跳转到同一设置面板内**已有**的诊断区，不出现第二套日志界面。
- [ ] 「快速参考」（与「重看引导」并列）主动打开：设置面板关闭，
      速查面板出现时**画布仍可点击/平移**（无模态遮罩），可收起；
      首次向导与「重看引导」仍在原处。

### 6. 三态主题（#60）

来源断言：`boxing-settings-persist.spec.ts` 的
`AC-real: first paint, live OS following, the three-state control, quick toggle and the persisted preference`。

- [ ] 新 profile 首次打开：页面跟随 OS 明暗首次显示后稳定为水合默认值；
      存储里只有偏好、不落 OS 解析结果。
- [ ] 「设置 → 外观」选「跟随系统」：切换 OS 明暗（不改页面存储）页面即时跟随。
- [ ] 显式选「明/暗」：不随 OS；页头快捷切换会在 system 下改为相反有效态的显式偏好。
- [ ] 重启同一 profile：偏好按保存值恢复。

### 7. 无人值守的自动备份（#124–#130 / spec #120 D2/D3/D5/D6）

来源断言：`boxing-bg-local-auto-backup.spec.ts`、`boxing-webdav-auto-backup.spec.ts`、
`boxing-gist-first-create.spec.ts`、`boxing-bg-auto-backup-retry.spec.ts` 的 VM 用例，
以及 Chrome 侧 `boxing-release-gate-loaded-build.spec.ts`（真构建、真后台、零 NTP 页）。
Firefox 侧这些断言只能在本清单人工做——CI 的 Firefox lane 不装插件，`file://` 页
更没有后台可言。**这一步没做过，就没有 Firefox 后台证据，发行不放行。**

准备：用专用测试 profile，先在本机起一个自己可控的 WebDAV 服务（或指向一台你能改、
能停的测试服务器）。**不要拿真实网盘当试验场**，本步会故意制造失败和改地址。

后台状态都在扩展自己的存储里，观察方式：`about:debugging#/runtime/this-firefox`
→ 本扩展 → 「检查」，在后台页 Console 里执行

```js
const s = await browser.storage.local.get(null);
({ keys: Object.keys(s), auto: s.autoBackupState, alarms: await browser.alarms.getAll() });
```

- [ ] **全新安装，什么都没开**：`keys` 里没有 `autoBackupState`、没有 `snap.v1.*`，
      `alarms` 为空。等 2 分钟再查一次，仍然没有——默认关闭，零自动上传。
- [ ] **刚打开开关就备份一次**：设置 → 同步 → 自动备份选「每天」打开。后台页里
      `auto.local.status` 变 `ok`、`lastSuccessAt` 是刚才的时间，`keys` 里出现
      `snap.v1.<ts>` 和 `snap.v1.index`，`alarms` 里出现 `boxing-auto-backup`
      （周期 1440 分钟）。这一步证明「开关打开 ≠ 成功」也证明「开了就立刻试一次」。
- [ ] **把 WebDAV 目标配好，并真的传成功一次**：设置 → 同步 → 选 WebDAV，填你起的测试
      服务地址、账号、文件名，先点「测试连接」确认能通，再点「立即备份」。远端应该真的
      出现备份文件；后台 `auto.remote.status` 是 `ok`、`remote.lastSuccessAt` 有值、
      `remote.provider` 是 `webdav`。**没有这一步，后面撤权、断网、条件写全都没法判**：
      目标都没配，后台当然什么都不会试，你看到的"没有上传"是假绿。
- [ ] **关掉所有 Boxing 页面，照样会备份**：把 NTP 标签全关，只剩这个测试 profile。
      想马上验证就到后台页 Console 执行
      `await browser.alarms.create('boxing-auto-backup', { when: Date.now() + 1000 })`。
      10 秒内再查 `snap.v1.*` 应该多一条、`lastSuccessAt` 前进。**没有任何 NTP 页
      参与**，这就是后台独立执行的证据。
- [ ] **重启浏览器只补一次**：把自动备份改成「每小时」，等它跑过一次后彻底退出
      Firefox，隔一段时间（或把系统时间往后拨过周期）重开同一 profile。重开那一刻
      后台就会**立刻**补一条（不是等下一个整点），`nextScheduledAt` 顺延一小时；
      之后走的是正常周期，不是又补一次。**重开后马上数一次就好，别等一小时再数**，
      否则会把「补做的那条」和「周期到点的那条」加在一起，误判成补了两次。
- [ ] **多开页面不会多跑**：补做完后同时开两个 NTP 标签，等一个周期，快照只多一条。
      （后台独占执行，标签数本来就不该影响次数；这一步是确认没有退回页面驱动。）
- [ ] **关掉开关立刻停**：把开关拨回「关闭」。后台页 `alarms` 里
      `boxing-auto-backup` 和 `boxing-auto-backup-retry` 都没了，`auto.optIn` 为
      `false`、`intervalSec` 为 `0`、`auto.local.status` 是 `cancelled`；上次成功的
      `lastSuccessAt` **还在**，没被抹掉，也不会被改写成一个假的成功。
      > **测完这一步，把开关重新打开，等它成功一次，再往下走。** 下面几步都要自动备份
      > 真的在试：开关关着时 alarm 已经清掉，你等一年也不会发生任何事，签出来的结果全是假的。
- [ ] **权限被收走就不许偷偷发请求**（开关已重新打开）：Firefox 里把本扩展的
      `https://*/*` 主机权限撤掉（或在 `about:addons` 里关掉站点访问），保持 WebDAV
      目标不变，等一个周期。
      设置页必须显示「待授权」一类的原因；后台 `auto.remote.status` 是暂停，
      `lastErrorCode` 指向权限；**不能出现任何新上传，也不能自己弹授权框**。
      手动点「测试连接」应能正常发起授权请求，授予后自动路径恢复。
- [ ] **云端挂了，本地不能跟着瞎报**（开关已重新打开）：**保持地址、账号、文件名一个字
      都不改**，只把 WebDAV 服务停掉（或拔网线），再等一个周期。本地快照照常有新条目、
      `auto.local.lastSuccessAt` 前进；`auto.remote.status` 是失败/暂停，
      `auto.remote.lastSuccessAt` **不动**。设置页两条状态各自独立显示，不是一句笼统
      「备份失败」。
      > 这里千万别改地址来制造失败：改地址走的是「目标变了」，那是**直接暂停、一次都
      > 不重试**的另一条路。混在一起就测不出重试。
- [ ] **有限重试**（开关已重新打开）：看到上一步那次失败的同时**立刻**记下
      `auto.retry.nextAt`（约 +5 分钟），别先去等整个周期，否则第一次重试早就过去了。
      之后 `attempt` 从 0 开始涨，`nextAt` 大约落在 +5、+15、+60 分钟（有 ±10% 抖动），
      最多 3 次，用完回到正常周期，不会无限刷。**这条要盯着后台真跑完三次，约 80 分钟**。
      VM 用例（`boxing-bg-auto-backup-retry.spec.ts`）验的是同一份 `background.js` 的
      逻辑，能补充细节，但**不能替代"Firefox 后台真的重试了三次并停下"这个证据**。
      没看完就写"只观察到第 N 次"，这条按**未完成**记，不能签通过。
      `Retry-After` 这条不在人工清单里搭台子：普通的 WebDAV 服务不会主动吐
      503/429 + `Retry-After`，要验得临时起个返回该头部的桩服务。要验就写明用了什么桩；
      不验就在记录里写"Retry-After 未覆盖"，别默认它没问题。
      鉴权失败（401/403）、地址无效、目标被外部改过这类情况**一次都不重试**，直接
      带原因暂停。
- [ ] **换了目标就停手**（开关已重新打开）：把 WebDAV 地址、路径、账号或文件名改一项，
      等一个周期。
      后台不会往新目标传、也不会往旧目标继续传；设置页提示需要重新确认。旧服务器上
      的备份文件**还在**，没有被删除或覆盖。
- [ ] **先把远端基线恢复回来**：上一步换过目标、前面还停过服务。把服务开起来、把地址/
      路径/账号/文件名改回原来那组，点「立即备份」成功一次，确认 `auto.remote.status`
      回到 `ok`、远端文件就是这一版。**这一步不做，下一步看到"暂停"分不清是远端被改还是
      目标还没确认回来。**
- [ ] **远端有别人的东西就不覆盖**（开关已重新打开）：在上一步恢复好的基线上，手动改一下
      备份文件内容（模拟另一台设备写过），再等一个周期。后台必须停下并说明远端已变，远端
      文件一个字都不许被盖掉。把条件写支持关掉（或换一个不认 `If-Match` 的假服务）
      同样停下，不能退回无条件 PUT。
- [ ] **Gist 这边只做首次创建**（开关已重新打开）：已有 Gist 的情况下开启自动备份，
      `auto.remote` 应停在「不自动更新」的暂停原因，后台零 POST/PATCH。手动「立即
      备份」仍可正常写入。
      （已有 Gist 的自动更新是产品决定不做，见 `docs/gist-conditional-write.md`。）
- [ ] **角标安静但要看得见**：上面任一失败/暂停后，工具栏图标角标出现提示；问题处理完
      （或手动备份成功）后角标自动消失；自始至终**没有系统通知弹窗**，manifest 里也
      没有 `notifications` 权限。
- [ ] **数据边界没被撑破**：随便打开一份新生成的 `snap.v1.<ts>` 和云端备份正文，搜
      `_encWebdavPass`、`_encGistToken`、`boxingCredKey`、密码、token、其他标签页标题
      或浏览历史——一项都不许出现。

## 结果记录

把结果写回当次发行票/报告，**每一项都要有**：

| 字段 | 写什么 |
|---|---|
| 版本号 | 本次 zip 的 `manifest.json` 版本，例如 `2026.11.1` |
| zip sha256 | 当次要上传的那个 zip 现算的哈希（不是本地重建的） |
| 浏览器版本 | 例如 Firefox 142.0（含渠道：Release / Developer Edition / Nightly） |
| 执行人 | 真名或固定 ID，别写"我" |
| 日期 | 年-月-日 |
| 每一步结果 | 逐条 ✅ / ❌，失败写实际现象和复现步骤 |

**任一步失败 = 发行阻塞**，不发布。别用"其他步都过了"来抵消。

## 边界

- 本清单只覆盖各 lane 头条断言，不重抄整套 spec；失败面与细节断言以
  `test/tests/` 对应 spec 的 file:// lane 在 CI 中维持。
- 不含未经验证来源的新拟验收数据；样例最小化自仓库既有 spec 夹具。
- 若清单与 spec 断言漂移，先改清单对齐 spec，再改 spec 需另走治理确认。
