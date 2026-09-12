# Wave8 收口硬验收（2026-09-12）

## 命令与结果

```
node .github/scripts/build.mjs
  → DONE_BUILD · boxing-chrome/firefox-2026.9.12.zip + crx/xpi · A8/A10 OK

node scripts/import-graph-guard.mjs
  → ok:true modules:15 edges:48 violations:[]

node scripts/waiver-ledger-check.mjs
  → OK — 2 rows, none expired, never-quarantine clear

node scripts/docs-pointer-check.mjs
  → PASSED 74 pointers / 9 docs

playwright -g "gate 2" (chromium-extension)
  → 2 passed

playwright conflict-copy + cred-encrypt + search (chromium-extension)
  → 18 passed (23.9s)
```

## 交叉矛盾

- 71-report 原未回填 gate2 → **已追加收口回填节**
- 其余 issue/README/CONTEXT 无互斥发行宣称

## 三层文档

- docs/CONTEXT.md: Wave8 settle 已写
- docs/adr/0017: 未改（合取保持）
- 代码: boot-theme / PIK facade / opt-in / debounce 在盘
