# Handoff — 11 书签默认当前标签页

## 票面
- Issue: issues/11-url-open-mode-default.md
- Spec: spec.md Wave4
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/11-url-open-mode-default.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/11-url-open-mode-default.md
2. spec.md Wave4
3. WORKFLOW.md §4.2
4. AGENTS.md
5. docs/CONTEXT.md
6. ntp/utils.js（defaultLayout / migrateLayout）
7. ntp/ntp.js（openBookmarkUrl）
8. ntp/settings-ui.js
9. ntp/popups.js（renderBookmarks 点击打开）
10. test/tests/boxing-settings-persist.spec.ts

## 本票 delta
- 默认与缺键 migrate → sameTab
- **保留**已存 newTab
- 同步所有 `|| 'newTab'` fallback 与 UI 注释
- popups 未设置分支不再走 FF browserSettings，视作 sameTab
- 文件面: utils.js / ntp.js / settings-ui.js / popups.js + test

## 调研依赖（atomcode-research）
低。设置迁移模式项目内已有多处；一般不必联网。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "快速查浏览器扩展设置项「默认值变更」的成熟迁移模式：如何区分用户显式选择与出厂默认，避免升级覆盖用户偏好；给 2-3 条工业实践要点即可。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 回报
- 报告: .scratch/architecture-recovery/reports/11-url-open-mode-default-report.md

## Suggested skills
- but
- playwright
