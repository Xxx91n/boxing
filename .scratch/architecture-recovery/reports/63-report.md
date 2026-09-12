# Report — 63 CRED 诚实标注或 per-install key（覆盖 A-017）

日期: 2026-09-12 · 窗口: prompts/63-credentials-honest-label.md · 状态: **完成（AC 全勾）**

## 1. 票面
- Issue: .scratch/architecture-recovery/issues/63-credentials-honest-label.md
- Handoff: .scratch/architecture-recovery/handoffs/63-credentials-honest-label.md
- 覆盖: **A-017**（源: wave7-flash-grill/decision-ledger.md D-004#3）
- 阻塞: None (can start immediately)

## 2. 动手前取证

| 事实 | 证据 |
|---|---|
| 密钥来自**随包常量**，非用户口令 | ntp/credentials.js:21 `CRED_APP_SECRET = 'boxing-sync-cred-v2-app-secret-2024'`；deriveCredKey() 以 PBKDF2(100k, SHA-256) 从该常量派生 AES-GCM-256 密钥 |
| 用户可见文档**伪称用户口令加密** | docs/privacy-policy.md 原 L21 / L50 / L59 三处 `encrypted with a user-provided password` |
| 全仓该伪称仅此一处文件 | grep -rln `user-provided password`（排除 node_modules/.git/.codex-tmp/dist）→ 仅 docs/privacy-policy.md |
| 信封格式与读回路径 | {v:2,s,iv,d}：v2 走常量派生；v1 {k,iv,d} 兼容；plain-string 视为明文；调用方落库字段 settings._encWebdavPass / settings._encGistToken |
| 相关测试面 | test/cluster-map.json: ntp/credentials.js → boxing-cred-encrypt.spec.ts（5 例） |

## 3. 选型裁决：**诚实标注（混淆级）**，不做 per-install key

依据为硬约束推导，不是偏好：

1. **per-install 随机 key 违反 ADR-0017 数据兼容义务。** 新装随机 key 后写入的 v2 信封，旧版代码（仍用常量派生）无法解出；ADR-0017 要求 schema 永不前向破坏，且 G-B 回滚演练必须验证「新版写入的数据用旧版代码读回无损失」。凭据属 boxingLayout 内持久化字段，一旦前向破坏，回滚即产生**静默凭据丢失**，与本项目「禁止静默覆盖」红线冲突。
2. **改名 _enc* 字段同样是一次性 schema 变更。** ADR-0017 要求迁移走 expand/contract 门禁；单发行内硬改名 = 前向破坏，且收益为零（纯 cosmetic，不提升保护强度）。
3. **本票红线**：禁 passphrase/KDF 用户口令架构重设计——两个方向都不许借机重写密钥体系。

故取**零行为变更**的诚实标注：信封格式、密钥派生、读回策略字节级不变，只纠正「它是什么级别的保护」这一表述。atomcode 调研（§7.1）独立佐证：商店公开的拒审判例缺失，灰色表述不可赌，诚实标注为唯一稳妥解。

**恒定值不可动**：字面量 `boxing-sync-cred-v2-app-secret-2024` 是**承重**的——改它会让所有已落库/已导出的 v2 信封变孤儿。本票只重命名标识符（CRED_APP_SECRET → CRED_OBFUSCATION_SECRET），字面量一个字符未改（已复核 intact=true）。

## 4. 落地清单

| 文件 | 变更 | 风险 |
|---|---|---|
| ntp/credentials.js | 文件头改为诚实标注（混淆级定位 + 威胁模型 + 禁止在用户可见文本称用户口令加密 + _enc* 字段名按 ADR-0017 保留的说明）；块注释改为 envelope at rest — obfuscation grade；CRED_APP_SECRET → CRED_OBFUSCATION_SECRET（2 处引用同步）；新增「字面量承重」警示 | 纯注释 + 模块内标识符，**零行为变更** |
| README.md | Privacy 段新增 1 条：凭据为**混淆而非用户密钥加密**，密钥随扩展分发，能被读到浏览器 profile 的人还原；Boxing 不索取口令、不持有用户密钥 | 文档 |
| docs/privacy-policy.md | 修正 4 处伪称（L21 数据清单 / L50 WebDAV 段 / L52 Gist 段 / L59 数据安全段）为 obfuscated envelope, not user-keyed encryption 并给出保护边界；Last updated 2026-08-08 → 2026-09-12 | 文档；渲染器已核验 |

## 5. AC 勾选

- [x] 在注释/隐私说明中选一并落地 → 选**诚实标注（混淆级）**，已落地 3 个文件
- [x] （per-install 分支不适用）未采用 per-install，理由见 §3；既有 _enc 数据读回策略**零改动**
- [x] 仅标注：字段/注释/README Privacy 措辞一致，不伪称强加密 → 注释、README Privacy、隐私政策三方一致；_enc* 持久化字段名按 ADR-0017 保留，并在源码注释内具名说明其为 legacy 名、语义 = obfuscated envelope
- [x] 禁止实现 passphrase/KDF 用户口令架构 → 未引入任何口令输入、KDF 参数变更或提示 UI
- [x] node --check / 相关测试不新增红 → 见 §6

## 6. 验证证据（可复核）

```bash
node --check ntp/credentials.js                       # exit 0
node scripts/import-graph-guard.mjs                   # violations: []
node scripts/migration-golden-guard.mjs               # {"ok":true,"passed":28,"total":28}
TEST_MUTEX_WAIT=1 node scripts/test-mutex.mjs full --project=chromium-extension boxing-cred-encrypt --reporter=line
```

- node --check ntp/credentials.js → **exit 0**
- import-graph-guard → **0 violations**（modules 14 / edges 48）
- migration-golden-guard → **28/28 通过**
- boxing-cred-encrypt.spec.ts → **5 passed (9.4s)**（v2 无 bundled key / 往返 / 旧 v1 兼容 / plain-string / 导出不含明文）

字节级复核：bytes=5968 lines=95 CRLF=false BOM=false；CRED_APP_SECRET 残留 **0**；CRED_OBFUSCATION_SECRET **2**；密钥字面量 **intact=true**。

## 7. 调研来源与结论

### 7.1 本次 atomcode 调研（串行 1 次，ctx source=atomcode，2026-09-12）

问题：密钥随扩展源码分发（用户无口令）时，CWS / AMO 对「加密」宣称的审核口径与合规措辞。

核验信源（8 份官方/法律原文全文）：CWS User Data FAQ（Q8 传输、Q9 at-rest 加密）、CWS Developer Program Policies（隐私政策 accurate and up to date / Misleading or Unexpected Behavior / Code Readability）、CWS policy updates 2026（Disclosure Requirements 收紧）、Firefox Add-on Policies、Mozilla Add-ons Blog 2025-06-23 政策更新、FTC Fandango/Credit Karma 和解令（虚假安全声明 §5 先例）、Hinshaw Law 判例分析、Hugo Landau 客户端密码学批评文。

结论要点：

1. **合规要点不在能不能写加密，而在把加密写成「算法事实 + 保护边界」**：可写 AES-256-GCM / PBKDF2 / HTTPS 等算法事实；讲效果（secure / protected / unreadable）必须紧跟限定语（against casual access only）。
2. **禁用词**：端到端加密 / E2EE、zero-knowledge、无法被任何人读取、military-grade、用你的口令加密 —— 均属 CWS Misleading or Unexpected Behavior 与 FTC §5 高危声明。
3. **主动压掉默示含义**：明写 no user-supplied passphrase / not E2EE，以规避 FTC「expressly or by implication」标准。本票措辞已含这一句。
4. **对本地文件的落地核对**：政策声明与实际实现一致（判定已达标，措辞即推荐版）；at-rest 算法形式满足 CWS Q9；HTTPS 强制满足 AMO 传输要求。
5. **信息缺口（诚实记录）**：商店公开拒审判例缺失（商店不公布拒审理由），「会因此被拒」属条款推导而非实证；CWS dashboard Privacy Practices 表单字段原文无法公开抓取；地区法（GDPR/CCPA/个保法）维度未展开。

### 7.2 复用结论（无新增调研问题）

- ADR-0017「数据兼容义务 / 回滚验收 RA-1..RA-6」—— 选型裁决的决定性依据。
- ADR-0016 四层 sync/backup 模型（envelope 层定位）。
- wave7 decision-ledger.md D-004#3 合并表：P1 定级 + 禁 passphrase 重设计。
- 渲染链路核验（本地）：.github/scripts/build-demo.mjs renderPrivacyPolicy() 支持 bold / inline code / links，且断言 `Boxing Privacy Policy` 与 `Last updated` —— 本次措辞可正常渲染为 privacy-policy.html（G-C 硬依赖），断言不破。

## 8. 残留风险与后续建议

1. **AMO manifest 数据分类申报（新增发现，非本票范围）**：WebDAV/Gist 备份属「传输用户数据」，AMO 自 2025-11-03 起要求新扩展在 browser_specific_settings.gecko.data_collection_permissions 申报。建议单独立票。
2. **商店文案禁用词扫描（新增发现）**：上架前需扫 docs/store-assets/ 之类 listing 草稿，确保无 E2EE / zero-knowledge 等表述。
3. **CWS Privacy Practices 表单一致性**：上架时 dashboard 勾选项须与本政策措辞一致（三处不一致 = 违规）。属发行窗口事项。
4. **注意术语边界**：CWS Code Readability 禁止的是**代码**混淆，本票的混淆指**静态数据**；对外文案只说 data obfuscation，避免出现 code obfuscation 字样。
5. **per-install key 若重启**：须按 ADR-0017 expand/contract 跨两个发行周期推进（先双读、后切换写），并先解决旧版读回与跨设备导出导入两条兼容路径；不得在卫生票内一次性切换。
6. **dist/ 为构建产物**：dist/boxing-chrome|firefox/ntp/credentials.js 由 npm run build 生成，本票不手改（避免把其他窗口未提交改动一起烘进产物）。
7. **未触碰的共享文件**：docs/CONTEXT.md、decision-ledger.md 当前工作区已有其他窗口未提交改动，本窗口不改；A-017 状态翻转由大脑窗口统一处理。
8. **Pages 生效时点**：隐私政策改动需下次 demo-deploy 重新渲染 privacy-policy.html 后才在 G-C URL 生效；Last updated 已同步为 2026-09-12。

## 9. 版本控制

遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR）。
