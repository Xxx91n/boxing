# 11 — render.js 纯几何/索引函数下沉 utils · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-02
- 状态: **done** — issues/11 验收 3/3 勾选; 本文件为收口用完整版
- 分支: `ticket-11-render-geometry-downsink` (独立分支, 无前票依赖)
- 提交: `pyn` (ntp/render.js + ntp/utils.js + issues/11 写回 + WORKFLOW §6 两条教训, 单 commit); 本报告文件补交同分支
- 上游依据: handoffs/11 + issues/11 (六候选切口清单) + spec.md (切口一: 纯几何/索引下沉 utils; 依赖方向: utils 被所有层引用) + WORKFLOW §4.2/§6

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| ntp/utils.js | 229 → 241 行 | `zoomAtPoint` 整函数 verbatim 迁入 (唯一字节改动 = decl 去 export 前缀) + 追加 `zoomAtPoint` 到导出表 + 头注释登记票11纯度审计 |
| ntp/render.js | 2775 → 2764 行 | 移除 zoomAtPoint 声明; utils import 表追加 `zoomAtPoint`; 两个调用点 (原 L2464/L2483) 零改动 |
| .scratch/.../issues/11-render-geometry-downsink.md | +§处置结论 | Status→done, 验收 3/3 勾, 六候选裁定表 |
| .scratch/.../WORKFLOW.md | §6 +2 行 | 票11 两条教训 (见下) |

## 六候选纯度定谳 (本票核心裁决, delta 条款执行)

任务书 delta: "名单外函数不搬; 发现非纯函数就地放弃并记偏离; verbatim+十层自验"。

| 候选 | 裁定 | 证据 |
|---|---|---|
| zoomAtPoint | **下沉 (唯一实施项)** | 全参数传值无闭包状态; `container.getBoundingClientRect()` 经参数传入 — 与 utils 既有居民 `screenToWorld` 同款模式, 即本仓库 utils 层纯度惯例是"参数传 DOM 读取可接受, 禁闭包状态/document 直引"; MIN_ZOOM/MAX_ZOOM 本就在 utils |
| dsuFind/dsuMake/dsuUnion | 放弃 (非纯) | 闭包引用 state.js 全局可变 Map (boxGroupId/groupMembers); 搬移须 utils 反向 import state, 违反 spec "utils 被所有层引用" 依赖方向 |
| clampCanvasPan | 放弃 (非纯) | 读 render 模块级缓存 canvasContainerSize + canvasContainer.clientWidth; utils.js L5 头注释 (票05 审计) 本就登记其纯度豁免; 且 ntp.js:L669/683 跨模块消费它 — 幸而放弃零爆炸半径 |
| boxMidPoint | 放弃 (非纯) | 经 getLargeBox/getSmallBox 查全局 boxById/smallBoxById, 另依赖 render 本地 TITLE_BAR_H |

"zoomAtPoint 数学部分" 的裁定说明: 任务书点名"数学部分"系对 DOM 壳的保守预期; 实测确认除参数传入的 rect 读取外无任何隐藏依赖, 整函数下沉使"数学部分"随之入 utils 且免造数学拆半畸形切面 (对齐 issues/11 验收项"原样导出"的字面要求)。

## 搬移办法 (与一期票05 同款 + 本票增强)

单一 Node 迁移脚本 ctx 包裹执行: 内存中完成全部断言后才落盘; PRE-WRITE 拦截失败零副作用 (三轮假失败均为断言自身笔误 — splice 缝合方向/三连空行全局检查未做 pristine 增量/census 漏数自注注释与正则未转义锚 — 已修正, 均未触盘)。十层自验: L1 marker 唯一性 / L2 边界缝合 / L3 pristine 状态 / L4 splice 缝合+空行增量 / L5 import 锚唯一 / L6 导出表+头注释锚唯一 / L7 逐字节 verbatim / L8 精确 census / L9 round-trip / L10 `node --check` 双文件 + ESM 冒烟 + **540 点黄金平价** (搬移后函数 vs 原数学逐点相等, 含 MIN/MAX_ZOOM 夹取边界)。

## 验证证据

- `node --check` render.js + utils.js 均 OK; ESM 冒烟 (temp .mjs 导入) 导出平价 + 行为正确。
- `git diff --check` 干净 (CRLF 红线)。
- `npm run build` 绿 (A7/A8 校验器过; STALE_DIST 为重建前正常提示)。
- **dist 契约不变**: 两 dist 的 utils 均含声明+导出、render 无声明仅 import, manifest v3 不变。
- **npm test: 372 passed (22.8m), exit 0** — 无超时项, 未触发"单跑必绿"规则。全量含 boxing-zoom/conn/DSU 系活体探针, 覆盖 zoomAtPoint 两条真实调用路径 (wheel zoom 画布+内画布)。
- `codegraph sync` 已跑 (BX-EXPLORE-003)。
- 源码断言测试面预检: test/ 无任何候选符号断言, 无需迁断言 (票04 教训免检通过)。

## 版本控制轨迹 (§4.2)

- 开工前 but status 认领检查: 工作区未提交项全属大脑窗 (.scratch 全套 + dev junction), 无人并行碰 ntp/ — 独立分支安全。
- `but commit -b ticket-11-render-geometry-downsink -m "..." zp ls qo py` → commit `pyn`。未 push, 未开 PR (§4.2)。
- 注意: issues/11 与 WORKFLOW.md 系大脑窗未提交的 A 级工件, 本票按 handoff 指令写入后随票提交 (untracked 文件无法按 hunk 切分, 整文件含大脑窗基线内容一并入库 — 若大脑窗后续对这两文件另有提交需注意重复添加冲突)。

## 给大脑的收口注意

1. **票12 (conn 图层) 前瞻**: DSU 三函数 + boxMidPoint 因状态耦合留在 render.js, 票12 整组搬迁时须连同 state.js 的 boxGroupId/groupMembers 一起评估 (spec 已裁决 conn 连同渲染调度状态整体迁移); clampCanvasPan 同理随画布变换域走。
2. **README 状态表未动**: .scratch/architecture-recovery/README.md 波次表中票11 仍标 ready-for-agent, 属大脑窗管辖文件, 本票未越权改。
3. **utils 头注释契约**: 新增票11登记行 (zoomAtPoint verbatim 来源 + screenToWorld 同款说明), 后续票请延续该头注释作为纯度契约台账。
4. **无偏离出任务书条款之外**: 六候选全部实测, 放弃五项均在 delta 授权内; 唯一解释性裁量是 zoomAtPoint"数学部分"→整函数下沉, 依据与影响已如上记录。

## WORKFLOW §6 新增教训 (已写回)

- 下沉候选纯度定谳先查目标模块既有惯例再裁 (screenToWorld 先例 → zoomAtPoint 整函数下沉); 机械名单必须逐一实测而非按名推断。
- 十层自验脚本的断言自身也要过审: 三轮假失败全来自断言笔误, PRE-WRITE 拦截层保证失败零副作用。