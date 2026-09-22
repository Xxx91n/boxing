# C04 — github-pages environment v* 放行（D-002 / D-004③）

> 日期: 2026-09-22 · Owner: agent（gh/API）· 未 tag、未 push、未触发 deploy

## 放行前

```
GET /repos/Xxx91n/boxing/environments/github-pages
```

- `deployment_branch_policy`: `protected_branches=false`, `custom_branch_policies=true`
- 既有 custom policies:
  | id | name | type |
  |---:|---|---|
  | 57922059 | gh-pages | branch |
  | 57922060 | main | branch |

**缺口**: release 发布触发 `demo-deploy.yml` 时 `github.ref = refs/tags/v*`，不在 custom 白名单内 → tag 发行时 Pages deploy 会被 environment 拦下。

## 操作

```
POST /repos/Xxx91n/boxing/environments/github-pages/deployment-branch-policies
{ "name": "v*", "type": "branch" }
```

## 放行后

```
GET /repos/Xxx91n/boxing/environments/github-pages/deployment-branch-policies
```

| id | name | type |
|---:|---|---|
| 57922059 | gh-pages | branch |
| 57922060 | main | branch |
| **60663394** | **v*** | **branch** |

## 边界（D-002 负向）

- 仅放行 environment deployment policy；**未**创建 tag、**未**发布 release、**未**改 workflow。
- C08（tag/商店）仍归用户。
- 完成定义对照: 「github-pages deployment policy 允许 v* tag 触发 deploy」→ **达成**。
