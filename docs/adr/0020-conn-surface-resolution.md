# ADR-0020: 连接渲染面按端点归属裁决（resolveConnSurface）

## Date
2026-10-14

## Status
Accepted（wave-2026.10.11 grill D-007 · Round-3 落地 · bug 修复）

## Context
连接存储为全局 `layout.conns`，端点键为分层格式 `large:L1` / `small:L1:S1`。历史实现把 inner↔inner 连接画在「当前激活的 inner SVG」上：在大盒 L1 内连接 S1↔S2 后，进入任意其他大盒内页，同一 connId 会再画一条孤立投影线；删除源头线条即删除 connId，全部投影一并消失（用户报告的「每个小盒子页面都出现复制粘贴一样的孤立线」）。根因：渲染层缺少「这条连接属于哪个坐标面」的裁决，投影面随激活面漂移。

## Decision
渲染前以 `resolveConnSurface(from, to)` 按端点键现算连接归属面域（`ntp/conn-layer.js`）：

- 同父 `small:LA:*` ↔ `small:LA:*` → 面 = `inner:LA`，仅在 LA 内页渲染；
- 跨父 `small:LA:*` ↔ `small:LB:*` → 分层坐标系无法表示该线段 → **隐藏并 `debugWarn`**；
- outer↔outer / outer↔inner → 按既有外层规则。

被否决备选：
1. 持久化 `conn.surface` 字段 —— reparent（小盒换父）后字段陈旧，渲染时现算天然正确；
2. 按面拆注册表 —— 数据模型复杂化且无收益；
3. 跨父连接画到 canvas 层 —— 视觉上穿过盒壁，比隐藏更误导；
4. 数据净化删除不可表示连接 —— 拒绝：连接数据一律保留（不可见 ≠ 删除），删除语义仅 = 删 connId。

## Consequences
- 正面：泄漏投影归零；reparent 无需数据迁移；连接数据零损失。
- 负面/妥协：跨父 small-small 连接不可见，用户跨父连线体验为「无反应 + console 警告」。
- 中性/约束：任何新增连接渲染路径必须先过 `resolveConnSurface`；回归断言由 D007-* 系列用例锁定（跨盒零线、同盒可见、删源全灭）。

## Review
- 复核日期：2026-11-13
- 复核项：跨父隐藏是否需要 UX 升级（如 toast 提示）；`resolveConnSurface` 是否被新渲染路径绕过。
- 复核结论：（待回填）
