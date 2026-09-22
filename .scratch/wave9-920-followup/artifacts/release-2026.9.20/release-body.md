Boxing 2026.9.20

一次数据完整性收口：删除书签真正生效（重进/同步不复活）、Pages 发行同步纳入门禁。

## 这版你能感觉到的变化

### 修复
- **删除的书签不再复活** — 书签弹窗里的单条删除现在走正式提交通道并写入墓碑；重开浏览器或拉取 WebDAV 同步后，已删书签不会再次出现
- **双击缩放误建小盒子** — 双击缩放在特定签名下（Firefox）可能重复创建小盒子的问题已修复

### 内部
- **写路径一致性**：新增书签与删除/重排同走统一变更入口（commit）
- **layout 旁路可审计**：改写豁免全部具名 + 到期日 + 工单路径；删除类保持零豁免
- **测试治理**：过期 flaky 豁免清零（2 撤账 + 1 观察，禁止续期）
- **Pages 发行链路**：允许 v* tag 触发部署；部署尾部自动核验 demo 版本与发行 tag 一致（过时但 200 的部署会变红）
- 测试硬化与对比度门禁接入本地 pretest 链

## 从哪里安装（推荐）

| 浏览器 | 安装 |
|---|---|
| **Firefox** | [Firefox Browser ADD-ONS](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) |
| **Edge / Chromium** | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) |

> 本 Release **不再提供** `.xpi` / `.crx` 下载。签名与更新由商店负责。

## 开发者 / 源码

- 源码见本仓库；本地构建：`npm ci && npm run build`
- 附件含商店源码审核包与 Chromium/Firefox zip（侧载/调试用）；校验见 `SHA256SUMS.txt`
- 隐私政策：https://xxx91n.github.io/boxing/privacy-policy.html

## 已知说明

- 本版为 **2026.9.20**。数据安全相关门禁背景见仓库 ADR-0017；发布检查单在文档区。
