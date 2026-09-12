# 证据 83 — B3 `search`×2 失败根因（供票 72 取用）

- 来源票: 83（搜索 debounce，A-033）· 归属面: 票 72（G-A broken 桶修绿）
- 日期: 2026-09-12 · 环境: 本机 file:// mock 车道（chromium，--allow-file-access-from-files）

## 结论

`boxing-search.spec.ts` 中「大盒标题过滤」「清空高亮」两例的红，**不是搜索逻辑的高亮/过滤缺陷**，
而是它们的播种方式在 file:// 车道下不成立：种子数据在 reload 之后丢失，页面上一个 `.large-box` 都没渲染，
因此无论 debounce 与否都不可能命中高亮。

## 复现与原始输出

探针按既有 spec 的写法逐步执行（goto → clear storage → reload → push 种子 → persistView() → reload）：

```
DBG_READY true
AFTER_RELOAD boxes=[]  domBoxes=[]  hasInput=true  counter=0  onboarding=false
PROBE      imm=0  after=1  items=0  firstId=null  cls=null
```

- `boxes=[]`：reload 后 `layout.boxes` 为空 —— push 进去的种子没被持久化或没被读回；
- `domBoxes=[]`：因此 `.large-box` 零渲染；
- `hasInput=true` / `onboarding=false`：搜索框与首运遮罩都正常，排除「元素被遮罩挡住」类假说；
- `after=1`：debounce 后的查询确实执行了一次（计数 0→1），只是 `items=0` —— 没有任何盒可匹配。

## 可行替播种（已验证）

不 reload，直接 push 后调用 `renderCanvas()`：

```
SEED_NO_RELOAD boxes=[probe-1]  dom=[probe-1]
BURST        before=0 imm=0 after=1 items=1 match=true hidden=false
ENTER_FLUSH  beforeFlush=1 itemsNow=1 after=2
```

票 83 的两例新用例即采用该播种，双浏览器绿。

## 建议

1. 票 72 修这两例时，先决定「播种契约」：要么修 `persistView()` 在 file:// 车道下的落盘/读回，要么改用无 reload 播种。
2. 若选择修持久化，注意这是 file:// mock 车道与 chrome-extension:// 真车道共用的路径，修前先确认扩展车道是否同病（本票只验了 file://）。

## 边界声明

- 本证据只定谳「reload 后种子为空」这一近因，**未定谳** persistView 在存储层的远因（mock 写入时机 / 迁移 / 读取竞态）。
- 票 83 未修改这两例，未触碰票 72 的文件面。
