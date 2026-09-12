# 慢放采集卡 — Chrome 车道（票 77 / 票 60 AC 4）

> 受众: 执行人（用户）。本卡产出票 60 AC 4 的人工慢放证据，落 evidence/60-flash/chrome/。
> 铁律: 验收对象 = 2026.9.12 候选工件（run 34689649760，含零闪现修复 898119eb）解包产物，勿复用 gb-2026.9.13。
> 本证据不进 G-B 六项、不进 ADR-0017 门禁（票 60 spec D-003: 自建证据目录）。无证据的勾选在复核时视同未勾。

## 0. 准备（一次性）

- [ ] 获取 2026.9.12 候选工件并解包到固定目录:
  `gh run download 34689649760 -n boxing-release-ubuntu-latest -D <固定目录>`
  若票 75/76 已建立 2026.9.12 解包目录，直接复用并记录路径: ________
- [ ] Chrome 加载: `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选解包目录中 chrome 侧（manifest.json 在目录根）。Chrome 版本: ________
- [ ] 前置记忆状态（在扩展里设置，制造"有记忆可恢复"的基线）:
  1. 设置 → 主题选**非默认**（如 forest，主题名: ________）
  2. 深色模式 ON
  3. 画布建 2-3 个盒子（含改名标题）
  4. 关闭 NTP → 重开一次，确认主题/暗色/盒子均已记忆（记忆态基线）
- [ ] 录制工具就位: DevTools Performance 面板（F12 → Performance），齿轮确认 Screenshots 勾选。

## 1. 路径 A — Performance 帧步进（主路径）

1. NTP 上 F12 → Performance → 点 Record → 立即 **F5 刷新 NTP** → 等 3 秒 → Stop。
   （刷新与首次打开走同一加载路径: boot-theme.js 阻塞 → stylesheets → 首帧；镜像已在第 0 步持久化。）
2. 时间轴上找到首个 paint 帧（Screenshots 轨道），**逐帧放大检查前 10 帧或直到盒子渲染完成**:
   - 每一可见帧背景 = 第 0 步记忆主题的背景色
   - 无 beige/默认亮色背景帧（暗色模式下无白色中间帧）
   - render 完成前无盒子内容可见帧（boot-pending 遮罩期只有主题背景）
3. 对前 3 帧 + 首个"盒子出现"帧逐帧截图（系统截图工具）存 chrome/。

## 2. 阳性对照 — 方法灵敏度自证（强烈建议）

1. NTP console（右键→检查→Console）执行（先存后删）:
   `const __bt = localStorage.getItem("boxingBootTheme.v1"); localStorage.removeItem("boxingBootTheme.v1");`
2. 重复路径 A 录制刷新: 首帧应出现**默认 beige 降级帧**（随后 loadSettings 以 boxingLayout 纠正回记忆主题 — 票 60 AC 5 降级路径）。
3. 捕获到 beige 帧 = 采集方法灵敏度证明；截图存 chrome/positive-control-beige.png。
4. 还原: `localStorage.setItem("boxingBootTheme.v1", __bt);` → 刷新确认主题恢复。
   （若阳性对照都拍不到 beige 帧，路径 A 证据无效，改以路径 B 为主。）

## 3. 路径 B — 系统录屏（辅路径，覆盖真·新开标签）

1. 启动 60fps 屏幕录制（OBS/系统录屏）。
2. **Ctrl+T 真新开标签**（DevTools 不在场，验证用户真实路径）→ 等 2 秒停止。
3. 播放器逐帧步进检查判定标准 F1–F3；录像存 chrome/B-newtab-recording.mp4（或关键帧导出）。

## 4. 判定标准

| # | 断言 | 通过条件 |
|---|---|---|
| F1 | 无默认 beige | 每一可见帧背景 = 记忆主题背景色 |
| F2 | 无亮暗跳变 | 暗色模式下无白色/亮色中间帧 |
| F3 | 无非记忆盒子 | render 完成前无盒子内容可见帧（遮罩期仅主题背景） |

边界: 浏览器 paint 前的纯白/空白帧（任何网页加载都有）**不算**闪帧；已渲染出 beige/亮色背景才算。

## 5. 证据落盘（chrome/）

- A-frames-1..3.png / A-first-box.png — 路径 A 逐帧截图
- A-performance-profile.zip — Performance 导出（可选增强）
- positive-control-beige.png — 阳性对照帧
- B-newtab-recording.mp4 — 路径 B 录像（可选增强）
- 结果回填 capture-notes.md（Chrome 节）

## 6. 回填与处置

- capture-notes.md: build 来源（run 34689649760 / version 2026.9.12）、Chrome 版本、主题名、F1–F3 各 pass/fail、日期、执行人。
- F1–F3 全 PASS → 票 60 AC 4 Chrome 车道证据成立。
- 任一 FAIL → 异常帧截图 + console/版本信息记入 notes，回报大脑开缺陷票（不回滚票 60）。
