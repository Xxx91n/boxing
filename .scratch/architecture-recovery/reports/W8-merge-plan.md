# Wave8 合并序（未执行 land — 目标 origin/main，land 即 push）

> 2026-09-12 · `but pull` 已完成（无 upstream 新提交）
> 收口文档已提交至本地分支 **wave8-closeout**
> 依赖文件已 amend 回源分支（70/73/74/81/71/76/77/78）

## 建议 land 序（逐支，禁 --whole-stack 平行栈误伤）

```
# G-A 链
but land t70-ga-set-diff-root-cause --yes
but land 71-ga-nq-bucket-fix --yes
but land t72-ga-broken-bucket-fix --yes
but land t73-boot-pending-e2e --yes
but land t74-ga-waiver-review --yes

# 发行/G-B 链
but land ticket-75-rel-artifact-download --yes
but land ticket-76-gb-manual-golden-path --yes
but land t78-issue9-close --yes
but land t77-slowmo-evidence --yes

# 功能票（无互相依赖）
but land ticket-79-conflict-copy-readout --yes
but land t80-merge-quality-spec --yes
but land t81-cred-per-install-key --yes
but land t84/popup-accent-fix --yes
but land t83-search-debounce --yes
but land 85-docs-productize --yes
but land ticket/86-hygiene --yes

# 若存在独立 82 分支名，按 but status 当时打印的名字 land

# 收口文档最后
but land wave8-closeout --yes
```

**执行前请再 `but status` 核对分支名**（并行窗可能已改名/合并）。
