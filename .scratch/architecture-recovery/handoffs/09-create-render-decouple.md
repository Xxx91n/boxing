# Handoff — 09 双击新建先渲染后落盘

## 票面
- Issue: issues/09-create-render-decouple.md
- Spec: spec.md（Wave4 addendum）
- 调查: 43-2026-09-12-wave4-investigation.md P1
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/09-create-render-decouple.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/09-create-render-decouple.md
2. spec.md（Wave4 节）
3. 43-2026-09-12-wave4-investigation.md（P1）
4. WORKFLOW.md §4.2 / §4.3
5. AGENTS.md（SEC-08 高频 save 规则）
6. docs/CONTEXT.md
7. docs/adr/0007-architecture-refactor-decisions.md
8. ntp/render.js（addLargeBoxAt / addLargeBox / addSmallBoxAt）
9. ntp/storage.js（只读理解 saveLayout 写链，**不修改**）

## 本票 delta
- 创建三入口改为 mutate → renderCanvas → saveLayoutDebounced（或 void saveLayout），禁止 await save 在 render 前
- 保留 CREATE_COOLDOWN / markCreate / BX-DEV-140d focus sink
- 可能新增或挂靠 Playwright spec（见 issue）
- 文件面: 主要 ntp/render.js + test/tests/*

## 调研依赖（atomcode-research）
中。若需对照工业「乐观 UI / canvas 创建反馈」模型再发 atomcode；首脑已用源码时序定根因，非强制。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展/画布应用架构调研员，结合 docs/adr 与 CONTEXT.md 心智模型：无限画布/白板类应用（tldraw、Excalidraw、Figma、Miro）在「用户创建对象」时，工业级成熟做法是先乐观更新本地 store 并立即渲染，再异步持久化；还是同步等待存储？请对比 optimistic UI 与 await-persist-then-render 的失败模式（静默堆积、双击重复、崩溃丢数据），给出 MV3 扩展 chrome.storage.local 场景下的推荐时序与防抖策略，并给可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 回报
- 报告: .scratch/architecture-recovery/reports/09-create-render-decouple-report.md
- 含: 声明→证据→结论、验收对照、测试、残留风险、教训

## Suggested skills
- but
- playwright
- atomcode-research（可选）
