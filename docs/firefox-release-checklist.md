# Firefox 发布前人工核验清单

> 来源：治理决议 #68（B — 声明局限并人工门控）；落地票 #69。
>
> **为什么需要这份清单**：CI 的 `firefox-extension` Playwright 项目不安装插件，所有
> 「实际扩展构建」断言只在 Chromium lane 运行（每个 OS job 有 5 条
> `the loaded build is a chromium lane` skip）。CI 绿**不构成 Firefox 证据**；
> Firefox 侧实际构建验证由本清单人工承担，纳入发行门禁（见
> `docs/publishing-guide.md`「发版强制规程」）。

## 执行准备

- [ ] **构建与校验**：从当次 **GitHub Release** 下载**将要上传商店的**
      `boxing-firefox-<ver>.zip` 及同 Release 的 `SHA256SUMS.txt`，核对校验值并在发行票
      记录（版本号＋sha256＋CI run URL；证据绑定到实际产物，不是本地重建）。
      `SHA256SUMS.txt` 只随 Release 发布、不在 build 工件中；若 Release 尚未发布，
      退取同一 CI run 的 build 工件 zip，本地 `sha256sum` 计算并记录。
      解压得到的目录即下文「构建目录」。
- [ ] **安装**：按步骤选择加载方式——
      - 第 4 步含**重启核验**：`web-ext run`／`about:debugging` 装的临时扩展重启即被
        卸载，不能单独承担它；标准发行（`amo_sign=true`）下工件 `.xpi` 未签名，
        普通发行版 Firefox 也无法持久安装未签名包。两种可行方式：
        1. **Firefox Developer Edition／Nightly／ESR**：`about:config` 把
           `xpinstall.signatures.required` 置 `false`，将上一步校验过的 zip
           （改名 `.xpi`）装入持久 profile——核验的是将要上传的同一字节。
        2. **两个连续 `web-ext run` 会话**共用同一持久 profile
           （`--source-dir=<构建目录> --firefox-profile <目录> --keep-profile-changes`）：
           manifest 的 gecko id 固定使扩展 ID 跨会话稳定、localStorage 跨进程持久；
           会话 1 触发像素缓存后关闭浏览器，会话 2 断网启动完成核验。该路径验证的是
           「新浏览器进程＋断网＋持久字节」断言本身，不覆盖 AMO 正式安装形态——
           在结果记录里写明所用路径。
      - `about:debugging` 手动临时加载（`manifest.json`）：仅用于第 1/2/3/5/6 步的
        快速冒烟，**不能用于第 4 步**。
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
      `web-ext run` 到同一 profile。打开 NTP：该图标仍显示
      （src 为 `data:image/png;base64,`，可点开看属性），不是空白。
- [ ] 检查 manifest（`dist/boxing-firefox/manifest.json`）：未因像素层新增权限。

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

## 结果记录

把结果写回当次发行票/报告（执行人、日期、构建 zip 版本、逐步 ✅/❌ 与备注）。
**任一步失败 = 发行阻塞**，不发布；记录实际现象与复现步骤。

## 边界

- 本清单只覆盖各 lane 头条断言，不重抄整套 spec；失败面与细节断言以
  `test/tests/` 对应 spec 的 file:// lane 在 CI 中维持。
- 不含未经验证来源的新拟验收数据；样例最小化自仓库既有 spec 夹具。
- 若清单与 spec 断言漂移，先改清单对齐 spec，再改 spec 需另走治理确认。
