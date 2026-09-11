# G-B 执行卡 — 人工 zip 黄金路径（票 49）

> 受众: 执行人（用户）。双浏览器各完整走一遍 G1–G6。
> 铁律: G-B 验收对象是**发行 zip 的解包产物**，不是仓库根目录、不是本地 dist 开发树。
> 每个 G 项完成后立即落证据文件（命名规则见 README）；无证据的勾选在复核时视同未勾。

## 0. 准备（一次性）

- [ ] 触发 `build.yml`（workflow_dispatch，需要时 `version=<VER>`），下载 run `boxing-release-<os>` 工件中的 `boxing-chrome-<VER>.zip` 与 `boxing-firefox-<VER>.zip`。run URL: ________
  - 一行式入口（版本号由发布权限方决定；勿复用 2026.9.12；本票默认建议不建 draft release、不打 tag）:
    `gh workflow run build.yml -f version=<VER> -f make_release=false -f amo_sign=true`
    版本号注意（build.yml 源码核验）: build.mjs 无版本号格式校验，但本包为 calver 惯例（如 2026.9.13），建议顺延新日期号；`amo_sign` 默认 false 会把该版本号在 AMO unlisted 签名中**燃烧**（AMO 同版本拒重复上传），若此号将来要走 AMO listed 提交或本轮只是 G-B 演练号，须 `-f amo_sign=true` 跳过签名保留版本号。
    跟踪: `gh run list --workflow build.yml --limit 1` → `gh run watch <run-id>`；工件: `gh run download <run-id> -n boxing-release-ubuntu-latest`
  - ✅ 本轮候选已备好（2026-09-12，代理按任务文本授权命令触发）：版本 2026.9.13 · run 34641377036（main，三 OS 全绿，amo_sign=true）→ 本项上列「触发 build.yml」与「下载工件」两步合并为一条：
    `gh run download 34641377036 -n boxing-release-ubuntu-latest -D D:/gb-2026.9.13`（✅ 已完成）
- [ ] 确定并获取**上一发行版**产物（事故档为 v3.7.8；以商店/Release 页最新已发行版为准）。版本: ________
- [ ] 校验 zip 完整性: `sha256sum boxing-*-<VER>.zip` → 记入 `00-artifacts.txt`（放各浏览器证据目录）
- [x] 解包到固定目录（**G4/G5 演练期间不得移动路径**，unpacked 扩展 ID 与路径绑定，移目录会换 storage）：
  - ✅ 代理已备好（2026-09-12）: `D:/gb-2026.9.13/chrome` 与 `D:/gb-2026.9.13/firefox`（zip 根即扩展目录本体，manifest.json 在根，无 boxing/ 子目录）；sha256 见各车道 `00-artifacts.txt`
- [ ] 准备 G3 用「旧备份」: 在上一发行版里 设置→导出 一份 `boxing-backup-*.json`（含与新版可产生同 id 分歧的场景更佳）

### 加载方式

- Chrome: `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `D:/gb-2026.9.13/chrome`（manifest.json 直接在该目录根；误选仓库根会显示 MV2 错误，那是根 manifest 双声明，非产物）
- Firefox（发布版）: `about:debugging#/runtime/this-firefox` → 加载临时附加组件 → 选 `D:/gb-2026.9.13/firefox/manifest.json`。注意: 临时附加组件在浏览器重启后卸载，**storage 可能随之失效**——G2「重开」用关闭/重开全部新标签页 + 扩展停用/启用循环完成；涉及升级/回滚的 G4/G5 车道建议改用 Dev Edition 或 Nightly（`xpinstall.signatures.required=false`，可直接安装 zip/xpi，扩展 ID 稳定、storage 跨重装保留），勾选单备注车道差异即可
- 升级触发的判定标志: 装载后 SW console 出现 `onInstalled reason=update` 相关日志，或 `snap.v1.index` 新增条目（见 G4）

### 存储查看入口

- Chrome: NTP 页面右键→检查→Console（或 `chrome://extensions` → 服务工作进程）
- Firefox: `about:debugging` → 本扩展 → 检查 → Console；命令里 `chrome.storage.local` 换 `browser.storage.local`
- 通用 dump（大存储裁剪掉快照正文，结果在控制台点右键 Copy object 存文件）:

```js
chrome.storage.local.get(null).then(o => {
  const slim = {}; for (const k of Object.keys(o).sort()) if (!k.startsWith('snap.v1.')) slim[k] = o[k];
  console.log('KEYS:', Object.keys(o).sort().join('\n')); copy(slim);
})
```

- 容灾键一览（快照 / 损坏归档 / 冲突副本）:

```js
chrome.storage.local.get(null).then(o =>
  console.log(Object.keys(o).filter(k => k.startsWith('snap.v1.') || /corrupt|conflict/.test(k)).sort().join('\n')))
```

- 快照索引:

```js
chrome.storage.local.get('snap.v1.index').then(r => console.log(JSON.stringify(r['snap.v1.index'], null, 1)))
```

---

## G1 全新安装（独立全新 profile）

1. 新建浏览器 profile（Chrome: `--user-data-dir` 临时目录；Firefox: `about:profiles` 新建）→ 装载解包产物 → 开新标签。
2. 走引导：Next×N 走完，另一轮用 Skip；关闭引导后点盒子/按钮/设置确认可交互。
3. 检查 NTP console 与 SW console 零 error（警告需截图供复核判断）。

证据: `G1-onboarding.png`、`G1-console.png`（DevTools Console 全貌，含 filter:Errors）。

## G2 建盒/改名/拖拽/缩放 → 重开数据完整

1. 建大盒、改名、建小盒 + 加 ≥3 条书签、拖拽移位、滚轮缩放、平移。
2. 截图「操作后」状态；关闭全部 NTP 页 → 重开（Chrome 另加整浏览器重启一轮）。
3. 对照：盒子数量/位置/标题/书签数一致；重开后再 dump 一次主键留档。

证据: `G2-before.png`、`G2-after.png`、`G2-layout-dump.txt`。

## G3 旧备份导入 → 合并/冲突副本，无静默覆盖

1. 记当前盒子/书签计数（G2 状态即可）。
2. 设置 → 导入 选择准备阶段的旧备份 JSON。
3. 验证: 本地已有数据仍在（合并追加或同 id 保留双方可见形态）；若同 id 分歧 → 容灾键一览命令里出现 `boxingLayout.conflict.*` 且索引 `boxingLayout.conflict.index` 有条目；设置数据区冲突入口可查（票 50/55 落地前以 storage 键为证）。
4. 禁止形态：导入后本地某盒子书签**无副本可查地消失** = 静默覆盖 → 该项直接判红并停止后续，回报。

证据: `G3-before-counts.txt`、`G3-after.png`、`G3-keys.txt`（容灾键一览输出）。

## G4 升级安装：pre-update 快照（COW）+ 迁移后完整、无冻结

1. 新 profile 装载**上一发行版**解包产物 → 建可辨识数据（≥2 盒、≥3 书签，记录计数与标题）。
2. 用候选版文件**覆盖同一解包目录**（保持路径=扩展 ID 不变，storage 才能跨升级保留）→ 扩展卡片点「重新加载」→ 触发 `onInstalled(reason=update)`。
3. **打开任何新标签之前**先跑一次「快照索引」命令：确认 `snap.v1.index` 已有本轮新条目（pre-update 语义，票 42/42R：COW 在迁移前）；容灾键一览里对应 `snap.v1.<ts>` 正文键存在。
4. 开 NTP → 验证：迁移后计数不低于第 1 步记录；界面无冻结（遮罩可关、可点击、hover 展开正常——2026.9.12 事故形态=全屏遮罩拦截指针）；NTP console 与 SW console 零 error。

证据: `G4-prev-counts.txt`、`G4-preupdate-index.txt`、`G4-after.png`、`G4-sw-console.png`。

## G5 回滚演练（新版数据 → 旧版代码读回）

**G5a 当前数据回滚**
1. G4 完成后（profile 里是新代码写过的数据），把解包目录文件**覆盖回上一发行版** → 扩展「重新加载」→ 开 NTP。
2. 验证：盒/小盒/书签计数不低于 G4 之后；console 无「数据破坏类」error；若触发 crash-rescue（出现 `boxingLayout.corrupt.*`）→ 必须验证主键重建无损并截图归档。

**G5b v2 单程路径样例（ADR-0017 具名项，必查）**
1. 取仓库 `test/fixtures/schema/legacy-v2.json` 的 JSON 内容（fixture 是数据文件，允许从仓库 checkout 取，不违反「产物测试」边界）。
2. 先 dump 当前 `boxingLayout` 确认存储形态（对象还是字符串），按**同形态**注入 fixture:

```js
chrome.storage.local.get('boxingLayout').then(r => console.log(typeof r.boxingLayout))
// 按上一行输出的形态，把 fixture 以同样形态 set 回 boxingLayout，然后关闭全部 NTP 页重开
```

3. 开 NTP 走首载路径 → 验证：v2 数据被规范化（connections/groups/schemaVersion 补齐，票 45 移交裁决：单程路径首载 crash-rescue/规范化须无损）；书签一条不少；不出现误报损坏（无 `boxingLayout.corrupt.*` 新增，除非复核确认损坏归档合理）。
4. 用后清理：恢复 G5a 末态数据（重新导入 G3 备份或恢复快照）。

证据: `G5a-oldcode-after.png`、`G5a-counts.txt`、`G5b-v2-firstload.png`、`G5b-keys.txt`。

## G6 发布权限确认（禁止无人复核发布）

1. 确认人（≥1 名具发布权限者）阅读：双浏览器勾选单与证据摘要 + 已知风险清单 + 回滚预案。
2. 已知风险清单（至少逐条过）:
   - G-A 残红/豁免状态（票 48 台账）；@data-golden continue-on-error 到期 2026-09-18（票 54）
   - v2 单程路径规范化延迟到首载（票 45 裁决，G5b 已演练）
   - CWS 回滚 = 新版本号重发上一版（~1 分钟免审；两版循环陷阱；丢弃进行中百分比）
   - AMO 回滚 = 上一批准版，资格 ≥2 批准版本，24h 更新窗口；AMO 无百分比发布（unlisted canary 替代）
3. 回滚预案：写明可回滚目标版本（填入勾选单「渠道与商店」节）+ 紧急修复通道。
4. 记录确认人姓名/日期/载体（推荐 #9 issue 评论，回复链接）。

证据: `G6-signoff.md`（确认文字或评论链接转录）。

---

## 回传

两份 `checklist-<VER>-<browser>.md` + 各浏览器证据目录完整后，commit 本目录或直接通知大脑窗口；复核与写回见 `writeback-draft.md`。
