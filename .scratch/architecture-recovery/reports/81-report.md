# Report 81 — CRED per-install key (A-031)

> 日期: 2026-09-12 · 分支: t81-cred-per-install-key (GitButler commit orl) · 检查点: 禁 passphrase 真加密重设计 — 未触碰

## 1. 交付物

| 文件 | 变更 |
|---|---|
| ntp/credentials.js | 全文重写 (95→188 行): v2 常量混淆 → v3 per-install key 信封 |
| ntp/sync-engine.js | bindSyncBackupUi 回填处惰性迁移 hook (decrypt → re-encrypt legacy 为 v3) |
| test/tests/boxing-cred-encrypt.spec.ts | v2→v3 断言 + 2 新测试 (PIK 独立持久化 / 导出无 PIK 名) |
| test/tests/boxing-memory.spec.ts | flushCredentials 测试 v2→v3 断言 |
| README.md (Privacy) | 凭据存储描述 → per-install random key, 不进 layout/导出/备份 |
| docs/privacy-policy.md (Data Security) | 同上, profile-reader caveat 保留 |

## 2. 设计 (对标 atomcode 22 源调研, ctx source=atomcode-81)

- **PIK**: 32 字节 CSPRNG, 首用生成, 存 chrome.storage.local 独立键 `boxingCredKey.v1` (b64)。
  **不进 layout** → buildSyncPayload / buildExportEnvelope / snapshots 天然不含 key → 关闭离线副本攻击面
  (导出 JSON / WebDAV/Gist 远端 / storage.sync 副本单独拿到不可解密)。对标: GCP 信封加密 "只存 wrapped DEK";
  1Password 恢复因子与数据分离 (此处因子=浏览器 profile)。
- **信封 v3** = {v:3, s, iv, d}, key = PBKDF2(PIK, per-record salt, 100k, SHA-256) → AES-GCM-256。
- **迁移 (AC2)**: AWS FORBID_ENCRYPT_ALLOW_DECRYPT 范式 — 写路径一律 v3 (encryptCredential 只产 v3);
  读路径按 v 分派: v3(PIK) / v2(退役常量, decrypt-only 桥, literal 按 ticket 63 LOAD-BEARING 保留) /
  v1 {k,iv,d} / plain-string。惰性收敛: bindSyncBackupUi 回填处 decrypt 后 re-encrypt 为 v3, 仅分歧时 saveLayout。
- **降级安全**: 旧 build 读 v3 失败返回 '' (常量密钥推不出 PIK), caller 重新提示, 无数据损坏。
- **file:// 测试车道**: 无 storage API 时回退会话级随机 key (SEC-01 mock 保持局部, 车道 roundtrip 保活)。
- **无 passphrase / 无提示** (检查点遵守, A-017 负向仍有效)。

## 3. 威胁模型诚实性 (AC4)

- **买到**: 离线副本攻击关闭 (导出/备份/sync 副本无 key 不可解); 单 profile 泄露不波及他机; 每安装独立 key。
- **买不到** (ticket 63 负向保留): 能读浏览器 profile 的行为体仍可解 (key 与密文同处 chrome.storage.local);
  能跑扩展的行为体同。W3C webcrypto#269: profile 驻留 key 是混淆边界非安全边界 — README/privacy 均如实写明。
- 无 "encrypted with a user password" 类表述; 无 passphrase prompt。

## 4. 验证

| 项 | 结果 |
|---|---|
| node --check ntp/credentials.js | exit 0 |
| node --check ntp/sync-engine.js | exit 0 |
| git diff --check (全部改动后) | clean |
| 完整性断言 (9 项: BOM/fragments/exports) | 9/9 PASS |
| ESM parse 冒烟 | exports 4 (decryptCredential, encryptCredential, initCredentialsFacade, perInstallKeyInfo) |
| Node 功能冒烟 | 4/4: v3 无捆绑 k / roundtrip PASS / legacy v2 桥解密 PASS / v3 错钥 failsafe 返回 '' |
| import-graph leaf 不变量 | credentials.js 零 import 语句, leaves/facades 集合成员未变 |
| 测试结构 | cred spec 7 用例 / memory spec 6 用例, 0 处 .toBe(2) 残留 |
| codegraph sync | Added 1, Modified 4 — 109 nodes |

CI-only 政策 (2026-09-04 用户令): 本机禁止构建/测试运行, e2e cred 回归归 CI (npm test / cred 相关 spec 走 CI lane);
本票专属验收 "cred 相关回归绿" 以 CI run 为准 (语法/完整性/功能冒烟为本地合规替代证据链, 同票 29 先例)。

## 5. AC 对照 (issues/81)

- [x] 新装 per-install secret — boxingCredKey.v1 独立键, 测试断言固化
- [x] 存量可读或迁移 — v2/v1/string decrypt-only 桥 + 惰性 re-encrypt 收敛
- [x] 导出/同步不破坏 — 载荷不含 PIK (测试断言), 信封经 unwrapExportEnvelope 还原, 旧备份可解
- [x] 文档诚实 — README + privacy-policy 更新, 买到/买不到双向写明

## 6. 完成定义对照 (handoff 81)

- issue AC 全勾 ✓ (本文件 §5 同步 issues/81)
- 报告 reports/81-report.md ✓
- 版本控制 WORKFLOW §4.2 ✓ (but commit, 分支 t81-cred-per-install-key, 未 push)
- 不 tag / 不宣称可发行 / 不扩 ADR-0017 ✓ · 禁 passphrase 重设计 ✓
- 调研: atomcode 22 源 (MDN/W3C/Chrome/OWASP/GCP/AWS/1Password/Fernet/BitLocker) + ADR/CONTEXT 回顾 ✓
- 冲突: 与 decision-ledger current (A-017 负向) 对齐, 无 revised, 无新 D-xxx


---

# 返工轮次 81R — credentials.js B-6 白名单合规（2026-09-12）

> 触发: W8-W1-brain-review.md PV-W8-81-1（票 81 报告验证清单未含 import-graph-guard; B-6×4 红）
> 覆盖: A-031 · 分支: t81-cred-per-install-key (GitButler) · 检查点: 禁 passphrase 真加密重设计 — 未触碰

## R1. 首脑违规点复核（开工第一句）

- **B-6 ×4**（认同）: ntp/credentials.js __storageGet/__storageSet 内 4 处 `chrome./browser.` 直访 storage 探测,
  B-6 白名单仅 ntp.js / sync-engine.js / popups.js(openBookmarksInNewTabs)。首脑引用行号 L72/73/80/81 与守卫
  本体输出一致（修正: 守卫语义上是「探测行」而非「字面调用行」—— L75/83 的 `api.storage.local.get/set`
  不含 chrome./browser. 前缀, 本身不触发 B-6）。
- **PV-W8-81-1**（认同）: 票 81 报告验证清单只跑了 node --check + git diff --check + 自建断言, 未跑守卫本体,
  属验证清单缺失。教训已吸收: 本轮验收含 import-graph-guard。

## R2. 修复（handoff 优先方案 1: 调整白名单）

scripts/import-graph-guard.mjs B-6 白名单为 credentials.js 增加条件放行（注释 ADR-0016 / 票 81 / 返工 81R）:

- 放行条件（最窄）: `typeof chrome/browser !== 'undefined' && chrome/browser.storage` 跨浏览器探测习语
  （PIK 存取链最小面）+ `storage.local.get/set\b` 字面调用行。
- **不削弱全局 B-6**（负面案例实证）: 临时 ntp 目录注入 `const evil = chrome.runtime.id;` 后守卫对
  credentials.js L189 报 B-6 → 白名单未放过 runtime/tabs/storage.sync 等其他 API。
- 中间态勘误: 第一版条件 `chrome/browser\.storage\.local|storage\.local\.get/set` 仍红——探测行
  (L72/73/80/81) 不含 `.local` 尾巴, 模拟循环逐行定谳后收窄为探测习语条件。两次失败后未盲改,
  以模拟输出为证据修正。

## R3. 验证（守卫本体纳入验收清单）

| 项 | 结果 |
|---|---|
| node scripts/import-graph-guard.mjs | **ok=true, 15 modules / 48 edges / 0 violations, exit 0** |
| 负面案例（chrome.runtime 注入 credentials.js） | 守卫报 B-6 L189 → 全局规则未削弱 PASS |
| node --check scripts/import-graph-guard.mjs | exit 0 |
| node --check ntp/credentials.js | exit 0 |
| node --check ntp/sync-engine.js | exit 0 |
| git diff --check | clean |
| cred 测试（CI-only 政策） | boxing-cred-encrypt / boxing-memory 归 CI lane; 本轮未改测试文件 |

## R4. AC 对照（issues/81R）

- [x] 已复核 W8-W1-brain-review.md 对应违规条目并写明认同/修正（R1 节）
- [x] 修复后 node scripts/import-graph-guard.mjs exit 0（R3 节）
- [x] node --check 相关文件 exit 0（R3 节）
- [x] 报告追加写入原 reports/81-report.md, 标题含「返工轮次」, 原记录未覆盖

## R5. 完成定义对照（handoff 81R）

- issue AC 全勾 ✓ · 报告追加 ✓ · 版本控制 WORKFLOW §4.2 ✓（but commit, 未 push）
- node --check + import-graph-guard 均绿 ✓ · 与 current 决策无冲突（A-017 负向保持, 无 revised）


---

# 返工轮次 81R2 — data-golden gate2 / PIK 写路径（2026-09-12）

> 触发: W8-W2-brain-review.md §0 gate2 FAIL + PV-W8-81R-1（81R 只闭环 B-6, 未处理 71/72 移交的 gate2）
> 覆盖: A-031, A-025 · 分支: t81-cred-per-install-key (GitButler) · 检查点: 禁回滚 PIK / 禁全局削弱 gate2 — 均遵守

## R2-1. 首脑失败签名（复核认同）

W8-W2-brain-review.md §0 实测签名（原文）:

    direct storage writes outside the facade:
    ntp/credentials.js return api.storage.local.set(obj);

成因认同: 票 81 PIK 在 credentials.js 直写 storage.local; 票 71 §6.1 已定谳归属（f76d9e13 可追溯）且
用户裁定移交本窗口; gate2 writeRe 分支 1 精确命中 `api.storage.local.set(`。81R 未处理属 PV-W8-81R-1, 认同。

## R2-2. 方案选择: facade（issue Notes 推荐 1）, 弃 scanner 窄例外

71-report 预写了「钉死形状」的 gate2 scanner 例外补丁（可套用）。本票选 **facade 收口**（任务书 delta
「优先 facade」）, 理由:

- **gate2 spec 文本零改动** — never-quarantine 家族门禁, 71-report 自己指出「改它即口径变更」;
  钉死例外虽合规仍是给 scanner 加攻击面。facade 方案 scanner 一字不动。
- **恢复 credentials.js 自述契约** "persistence left entirely to callers" — 票 81 的直访其实违背了该契约, 本票修复。
- **结构不变式取代调用者纪律**: storage.js 窄端口 credKeyGet/credKeySet 前缀钉死 boxingCredKey.*,
  非前缀键 reject — 端口在结构上**不可能**写 boxingLayout, 满足「禁止恢复 credentials 对 layout 的写入」。
- issue AC 双不变量保持: credentials.js 仍零 import（叶子不变量, 经 initCredentialsFacade 注入口 —
  与 debugErr 票 10 / mirrorWriter 票 60 同款门面模式）; 81R B-6 窄白名单原样保留（收口后休眠,
  防未来回潮, 不构成削弱）。

## R2-3. 变更

| 文件 | 变更 |
|---|---|
| ntp/storage.js | +credKeyGet/credKeySet 窄端口（boxingCredKey.* 前缀钉死, 注释 81R2/ADR-0016） |
| ntp/credentials.js | 删 __storageGet/__storageSet 直访探测对（B-6×4 源头消失）; getPerInstallKeyB64 改走注入 credKeyStore; 无 store 时会话密钥回退保 file:// 车道; perInstallKeyInfo 增 injected 字段 |
| ntp/ntp.js | storage.js import +credKeyGet/credKeySet; initCredentialsFacade 注入 { get: credKeyGet, set: credKeySet } |
| test/tests/boxing-cred-encrypt.spec.ts | 持久化测试防竞态（poll injected===true 再 probe — 票 01 就绪信号教训）+ 双车道断言（扩展读 chrome.storage.local / file:// 读 41R mock 'bxstore:' 前缀）; +源码契约测试（端口前缀钉死 + credentials.js 可执行行零直访, 与 gate2 同逐行跳注释语义） |
| scripts/import-graph-guard.mjs | 本票无改动（81R 白名单保留休眠） |

file:// 车道语义变化（如实记录）: 注入来自 ntp.js mock layoutStorage → PIK 在 file:// 下也从会话态
变为落 'bxstore:boxingCredKey.v1'（与 snap.v1 同约定, 41R mock 通用多键持久化的自然结果）。

## R2-4. 验证（全实测, 非静态自证）

| 项 | 结果 |
|---|---|
| gate2 精确模拟（writeRe+trio+header+端口前缀+纯度断言） | 全 PASS（0 violations, trio 钉死计数 3 不变） |
| Node 功能冒烟（injected store 路径） | v3 无 k / roundtrip / PIK 经端口持久化 / 前缀 guard — 全 PASS |
| node --check credentials/storage/ntp/import-graph-guard | 4/4 exit 0 |
| node scripts/import-graph-guard.mjs | **0 violations, exit 0** |
| **npx playwright ... --project=chromium-extension -g "gate 2"** | **2 passed**（gate2+gate2b, 16.2s） |
| boxing-cred-encrypt spec（8 用例） | **8 passed** 串行（首轮 2 workers 并行 2 失败 = 浏览器启动饥饿 flake, launch 日志挂起签名, 符合票 01 备案; 串行确定性复跑绿） |
| boxing-memory spec（含 flushCredentials v3 断言） | 6 passed |
| boxing-webdav spec（cred 关联面） | 7 passed |
| boxing-sync spec（cred 关联面） | 8 passed |

## R2-5. AC 对照（issues/81R2）

- [x] 已复核 W8-W2-brain-review.md §0 gate2 失败签名与 71-report §6.1 / 81-report 返工节（R2-1）
- [x] npx playwright test --project=chromium-extension -g "gate 2" 全绿（R2-4, 2 passed）
- [x] node scripts/import-graph-guard.mjs 仍 exit 0（R2-4）
- [x] node --check ntp/credentials.js ntp/storage.js exit 0（R2-4, 含 ntp.js 共 4/4）
- [x] 报告追加本「返工轮次 81R2」节, 81/81R 原记录未覆盖

## R2-6. 门禁口径确认

- 未回滚 PIK（v3 信封/独立键/不进导出 —— 语义与票 81 完全一致, 仅写路径合规化）。
- gate2 全局口径未削弱（spec 文本零改动; ntp/** 新增直写照旧转红; storage.js 端口是门面内部, 属
  "All boxingLayout writes flow through this module" 契约的正确形态）。
- 与 current 决策无冲突, 无 revised, 无新增豁免; 未 tag、未宣称可发行。
- 归属票 71 的专属验收「data-golden job 与主 lane 同绿」至此 gate2 面解除（71 §6.1 移交项闭环）。
