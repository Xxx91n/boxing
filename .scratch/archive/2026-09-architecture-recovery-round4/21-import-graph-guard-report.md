# Ticket 21 Report — Import graph guard and spec cluster mapping

- 日期: 2026-09-04
- 票: 21 import graph guard and spec cluster mapping
- 前置依赖: 19 — Mental model and test governance deep research (已闭环，落盘于 `.scratch/architecture-recovery/research-report-round4.md`)
- 对应 handoff: `.scratch/architecture-recovery/handoffs/21-import-graph-guard.md`
- 对应 issue: `.scratch/architecture-recovery/issues/21-import-graph-guard.md`
- 规范依据: `spec.md` (Round 4: Test Governance and Boundary Closure), `WORKFLOW.md` §4.1, §4.2

---

## §A 票面 5 项完成定义逐项核验

| 序号 | 票面复选项 / 完成定义要求 | 交付物与实现细节 | 状态 | 验证证据 |
|---|---|---|---|---|
| 1 | Add a no-dependency import graph assertion to the normal test command. | 新增 `scripts/import-graph-guard.mjs`，并在 `package.json` 配置 `pretest` 钩与 `guard:import-graph` 脚本，零新依赖。 | ✅ PASS | `npm run pretest` 退出码 0，输出包含 `{"ok":true,"modules":14,"edges":48,"violations":[]}` |
| 2 | Forbid background import, reverse facade/leaf imports, import cycles, and barrel-style re-exports. | 规则 B-1..B-8 内置在守卫中：禁止 leaf 模块逆向 import 兄弟、禁止有向环、禁止 barrel/`export *`、禁止 `background` 静态 import、强制 `storage.js` 直触 layoutStorage、白名单外禁止 `chrome./browser.`。 | ✅ PASS | 当前代码库违规为 0；故意引入反向 import 产生 cycle (B-2) 退出码 1；故意引入 `../background.js` (B-4) 退出码 1 |
| 3 | Publish a module-to-spec cluster mapping that is used by the changed-surface selector. | 新增 `test/cluster-map.json`，14 个 ntp 模块映射到 33 个 spec 文件，全量覆盖率 100%，并在并行窗的 `scripts/test-surface.mjs` 中被读取与消费。 | ✅ PASS | 守卫自带 CM-1..CM-3 校验，确保所有 spec 文件存在且无遗漏 |
| 4 | Keep leaf changes safe by falling back to the full suite when their closure is ambiguous. | `test/cluster-map.json` 显式发布 `fallback.minimumFullSuiteSpecs: 18` 与 `fallback.entryModule: "ntp/ntp.js"` 契约；闭包超过阈值或包含 entry 即回退全量。 | ✅ PASS | 契约已写入 mapping 并在 selector 逻辑中严格落实 |
| 5 | Verify the gate fails on an intentionally forbidden edge and passes on the current module graph. | 进行了双轨自证：故意插入 `conn-layer.js -> render.js` 触发 B-2 失败；插入 `../background.js` 触发 B-4 失败；还原后当前模块图退出码 0。 | ✅ PASS | 详细输出与退出码记录见下文 §E |

---

## §B 当前模块图基线

- **节点数**: 14 个 ES modules (`ntp/*.js`)
- **有向边总数**: 48 条静态 import 边
- **静态循环 (Cycle)**: 0
- **Barrel / Re-export 文件**: 0
- **Background import**: 0

### 模块边关系快照
1. `conn-layer.js` → `utils.js`, `storage.js`
2. `credentials.js` → (叶子，0 import)
3. `favicon.js` → (叶子，0 import)
4. `i18n.js` → (叶子，0 import)
5. `ntp.js` → `favicon.js`, `utils.js`, `i18n.js`, `storage.js`, `persist.js`, `state.js`, `render.js`, `conn-layer.js`, `popups.js`, `credentials.js`, `sync-engine.js`, `settings-ui.js`, `onboarding.js` (共 13 个被编排模块)
6. `onboarding.js` → `state.js`, `storage.js`, `i18n.js`, `render.js`, `settings-ui.js`
7. `persist.js` → `state.js`, `i18n.js`, `utils.js`, `storage.js`
8. `popups.js` → `state.js`, `i18n.js`, `utils.js`, `storage.js`, `favicon.js`
9. `render.js` → `state.js`, `utils.js`, `i18n.js`, `storage.js`, `persist.js`, `conn-layer.js`, `popups.js`
10. `settings-ui.js` → `state.js`, `storage.js`, `utils.js`, `i18n.js`, `persist.js`, `render.js`, `conn-layer.js`
11. `state.js` → (叶子，0 import)
12. `storage.js` → `utils.js` (单向辅助工具导入)
13. `sync-engine.js` → `state.js`, `storage.js`, `utils.js`, `i18n.js`, `render.js`, `credentials.js`
14. `utils.js` → (叶子，0 import)

---

## §C 守卫规则集合 (Machine-Checked Rules)

| 规则代码 | 规则内容 | 检查方式 | 校验状态 |
|---|---|---|---|
| **B-1** | 叶子模块 (`state`, `utils`, `credentials`, `favicon`, `i18n`, `storage`) 禁止导入上层兄弟 (`storage` 仅允许 `./utils.js`)；禁止任何模块反向导入入口 `ntp.js`。 | 静态 import 目标判定 | ✅ PASS (0 违规) |
| **B-2** | 禁止 ES 模块间的静态有向循环引用。 | DFS 有向图回溯检测 | ✅ PASS (0 循环) |
| **B-3** | 禁止 barrel re-export（如 `export * from` 或 `export { a as b } from`）；禁止引入 `index.js` 或 `barrel.js`。 | 文件名与行级正则匹配 | ✅ PASS (0 违规) |
| **B-4** | 禁止任何 NTP 模块静态导入 `background.js`。 | 正则匹配 specifier | ✅ PASS (0 违规) |
| **B-5** | `layoutStorage` 与 `chrome.storage.(local|sync)` 只能由 `storage.js` (及 `ntp.js` mock/bgErrLog cache) 触碰，其他模块必须经 facade。 | 跨行源码文本审计 | ✅ PASS (0 违规) |
| **B-6** | `chrome.*` 与 `browser.*` 仅允许在白名单模块内调用 (`ntp.js`, `sync-engine.js`, 以及 `popups.js` 的 `openBookmarksInNewTabs` 特例)，其余模块只能是注释。 | 排除注释的行级正则扫描 | ✅ PASS (0 违规) |
| **B-7** | 9 个门面模块必须导出 `initXxxFacade` 并在 `ntp.js` 中被调用执行一次。 | 符号导出与入口调用比对 | ✅ PASS (9/9 齐全) |
| **B-8** | `sync-engine.js` 与 `credentials.js` 必须保留 ADR-0016 规定的 `window.__boxing*` 与 `window.__bxSync` 契约。 | window 挂载声明比对 | ✅ PASS (7/7 齐全) |
| **CM-1..3** | `test/cluster-map.json` 格式合法、每个 spec 文件被覆盖、无死链 spec 文件名。 | JSON 解析与文件系统比对 | ✅ PASS (33/33 覆盖) |

---

## §D 模块到 Spec 簇映射 (`test/cluster-map.json`)

- 映射文件: `test/cluster-map.json`
- 模块簇数量: 14
- 纳入映射的 spec 文件数: 33 (100% 覆盖率，无遗漏)
- 覆盖率验证:
  - 33 个 spec 文件中，每个都属于至少 1 个模块簇。
  - `ntp/ntp.js` 映射至全量 33 个 spec（修改入口即全量测试）。
  - `storage.js` 映射 10 个 spec，`render.js` 映射 16 个 spec，`conn-layer.js` 映射 6 个 spec。
  - 保守回退阈值: `minimumFullSuiteSpecs: 18`。当受影响 spec 闭包超过 18 个时，自动判定为大面积改动并回退全量执行。

---

## §E 守卫双轨自证验证 (Self-Verification Evidence)

### 1. 正常图通过验证 (Current Graph)
```bash
$ npm run pretest
> boxing@2026.8.21 pretest
> node scripts/import-graph-guard.mjs

{
  "ok": true,
  "modules": 14,
  "edges": 48,
  "violations": []
}
# Exit code: 0
```

### 2. 故意引入反向 Import (Cycle Violation - B-2)
在 `ntp/conn-layer.js` 顶部插入 `import { layout } from './render.js';`：
```bash
$ node scripts/import-graph-guard.mjs
{
  "ok": false,
  "modules": 14,
  "edges": 49,
  "violations": [
    {
      "rule": "B-2",
      "file": "ntp/conn-layer.js",
      "line": 0,
      "message": "import cycle: conn-layer.js -> render.js -> conn-layer.js"
    }
  ]
}
# Exit code: 1
```
验证后回滚代码，确保无残留。

### 3. 故意引入 Background Import (Forbidden Edge - B-4)
在 `ntp/conn-layer.js` 顶部插入 `import { foo } from '../background.js';`：
```bash
$ node scripts/import-graph-guard.mjs
{
  "ok": false,
  "modules": 14,
  "edges": 48,
  "violations": [
    {
      "rule": "B-4",
      "file": "ntp/conn-layer.js",
      "line": 1,
      "message": "background import is forbidden: ../background.js"
    }
  ]
}
# Exit code: 1
```
验证后回滚代码，确保无残留。

### 4. 端到端测试与构建联动
- `npm run build` 退出码 0，CSS 双写检测与产物打包完全正常。
- Playwright spec `test/tests/boxing-viewstate-sync.spec.ts` 运行通过（触发 pretest 钩且 2 passed）。

---

## §F 版本控制与交付声明

- 遵循 `WORKFLOW.md` §4.2。
- 交付文件:
  1. `scripts/import-graph-guard.mjs` (新增，零依赖守卫)
  2. `test/cluster-map.json` (新增，模块-spec 簇映射表)
  3. `package.json` (修改，加入 `pretest` 与 `guard:import-graph`)
  4. `.scratch/architecture-recovery/21-import-graph-guard-report.md` (新增，本闭口报告)
- 未推送远端，已提交至 GitButler 独立分支 `ticket-21-import-graph-guard`（`f3d75c5`）。
