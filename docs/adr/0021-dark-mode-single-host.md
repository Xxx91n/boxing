# ADR-0021: 暗色类单宿主收敛（applyDarkMode → documentElement）

## Date
2026-10-14

## Status
Accepted（wave-2026.10.11 grill D-008 · Round-3 落地 · bug 修复）

## Context
暗色双缺陷：①boot 期 `ntp/boot-theme.js`（classic script，非 module）把 `ntp--dark` 写在 `<html>`，而运行期设置在另一个宿主上操作类 → 类只加不删，暗进场后切不回日间，新建标签页重跑 boot 才恢复；②远端同步合并 settings 后不重放主题、不重写 boot 镜像 `boxingBootTheme.v1` → 刷新后暗色丢失。两个症状共享一个根因：暗色类所有权不对称 + 同步后无重放。

## Decision
- `ntp--dark` 唯一宿主 = `document.documentElement`（CSS 选择器 `:root.ntp--dark`）。
- 全部明暗切换收敛到 `ntp/persist.js` 的 `applyDarkMode()`；`ntp/storage.js` 在外部合并/回放完成后重放 `layout.settings.darkMode` 并重写 boot 镜像。
- `chrome.storage.onChanged` 监听注册留在 `ntp/storage.js`（监听不搬家的既有约定），回调内调 `applyDarkMode` 幂等重放。
- `boot-theme.js` 保持 classic script 自含最小逻辑（不能 import ESM），主脚本启动时校准一次对齐。
- `matchMedia` 仅作无显式偏好时的显示回退，**禁回写 `settings.darkMode`**（否则覆盖用户显式偏好）。

被否决备选：system-follow 联动、`data-theme` 属性方案、字段级 last-writer-wins —— 均属本波范围外（D-010）。

## Consequences
- 正面：明↔暗双向切换稳定；跨端同步后主题一致；boot 首帧零闪（镜像 + 重放闭环）。
- 负面/妥协：boot 与运行期存在两处最小逻辑并行（classic script 限制），靠启动校准对齐——接受，因 boot 转 module 成本高于收益。
- 中性/约束：新增主题相关类必须挂 `document.documentElement` 且经 `applyDarkMode`；禁第二宿主、禁回写 matchMedia 结果。

## Review
- 复核日期：2026-11-13
- 复核项：boot/运行期双写是否值得收敛（boot 转 module 成本重估）；matchMedia 回退是否产生用户困惑反馈。
- 复核结论：（待回填）
