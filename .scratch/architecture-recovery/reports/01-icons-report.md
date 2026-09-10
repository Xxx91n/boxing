# Report — 01 icons 与 brand 策展图对齐

日期: 2026-09-10 | 窗口: 01-icons 子窗口 | GitHub: issue #1 / milestone 2026.9.12

## 变更摘要
1. `icons/icon_48.png`、`icons/icon_128.png` 覆盖为 `docs/brand` 策展图（copy-over，非再生成）：
   - icon_48: 722B 紫占位 → 1896B，sha256=adef0e17c22b5dce（与 brand 源一致）
   - icon_128: 2286B 紫占位 → 5716B，sha256=844724ab116adafb（与 brand 源一致）
2. `.github/workflows/build.yml`：删除 "Setup Python (icon generation)" 与 "Regenerate brand icons"（Pillow/LANCZOS 从 logo-light-theme 再生成）两个步骤，替换为单个 Node 步骤 "Copy curated brand icons (icons/ from docs/brand)"：
   - 从 docs/brand 复制全部 `icon_NN.png`（当前 16/32/48/128）进 icons/，作为漂移守卫并补全未入库尺寸；
   - 保留并加强断言：PNG 签名（\x89PNG 魔数）、文件名尺寸 == IHDR 实际宽高、目标字节 == 源字节；
   - 末尾断言 manifest.json 引用的 icons/icon_48.png 与 icon_128.png 存在；
   - icons/ 目录未删除，manifest.json（icons + action.default_icon 引用 48/128）未改动。
3. 关键决策：以策展 docs/brand 资产为唯一图标源（handoff delta + spec「Icons」决策）；放弃 Pillow 再生成路径，消除「商店 logo ≠ 工具栏图标」的根源；工作流不再需要 Python（全文件 grep 确认 python 仅图标步骤使用）。

## 验收对照（issues/01-icons.md）
- [x] icons/icon_48.png and icons/icon_128.png byte-match docs/brand curated icons —— sha256 前16位逐一比对一致。
- [x] CI icon step copies from docs/brand (PNG signature assert kept) —— build.yml 新步骤 copy-from-brand，PNG 签名断言保留并加尺寸/字节一致断言。
- [~] npm run build green; dist icons match brand —— 按 CI-only 构建策略（2026-09-04 用户强制令）本机不跑构建；已做等效静态验证（见测试结果），最终以 CI run 为证据，由大脑 Agent 推送验证分支触发。

## 测试结果（本机静态验证，未运行任何构建）
- YAML：`js-yaml` 解析 build.yml 通过；步骤列表 11 项，python/pillow 引用清零。
- 新图标步骤脚本：从 YAML 提取 heredoc 正文，以仓库根为 cwd 实际执行 PASS（128/16/32/48 全部 OK 行输出），执行后 icons/48、128 字节不变（幂等）；验证后删除脚本临时复制出的 16/32（本票范围只入库 48/128，16/32 由 CI 构建时补全——与旧行为一致）。
- `git diff --check` 干净；build.yml 保持 LF，无 BOM 注入。
- 引用面复查：全仓仅 manifest.json / dev-chrome / dev-firefox 引用 icons/icon_48|128.png，路径未变，无需改动。

## 残留风险
- dist 字节一致性的最终证据在 CI（"npm run build green" 验收项待 CI run）；build.mjs 以 copyTree(ROOT) 打包 icons/，入库字节 == brand 即 dist == brand，逻辑上已闭合。
- docs/brand 无 icon_256.png：旧 CI 会向 dist 塞 256（未被任何引用使用），新步骤不再产出——属预期收敛，若商店素材需要 256 应在 docs/brand 策展后自动生效。
- 与并行票 05（test/tests/boxing-state-sync.spec.ts）无文件交集；本票未触碰其他票文件。

## 版本控制
遵循 WORKFLOW §4.2：独立分支 01-icons 提交，含 icons/icon_48.png、icons/icon_128.png、.github/workflows/build.yml、本报告。不 push、不开 PR。

## 教训
- 若本地手动模拟执行 CI 图标脚本，会向 icons/ 补入 16/32 未跟踪文件——验证脚本执行后需按票面范围清理工作区，避免污染他人 diff 视图。
