# 2026-09-12 Wave4 收口摘要

> 归档自: `.scratch/architecture-recovery/`（Wave4 + 发行合并）
> 远程 main: origin/codeberg/gitlab @ d11672f（land 后）

## 合并结果

| 栈/分支 | 动作 |
|---|---|
| fix-release-pipeline + 03 + 01 + 08 | land --whole-stack |
| 04-sync-ui | land |
| 07 + 06 pages | land --whole-stack |
| 09 create-render | land |
| 02/05/03-mirror/12/11/10/13/docs-wave4/docs-arch + 07/08 mirrors | land --whole-stack |

## 构建证据

- `npm run build` → DONE_BUILD；A8 CSS dual-write OK；A8.0 ntp.css 63323 chars
- 产物: boxing-2026.9.12.zip (chrome/firefox) + crx/xpi
- 版本: manifest+package 2026.9.12；name=__MSG_extensionName__

## CI / Pages

- land 后 origin/main 触发 Test + Mirror；Mirror 成功；pages-build-deployment 有成功 run
- demo-deploy.yml 需 release published 或 workflow_dispatch（无 ref 输入）

## 已知残留

- V-W4-1: 10 的文件落在 13 提交内（树内正确，历史归属未拆）
- 本地 `main` ref 仍停在 be0d6b8 旧分叉线（与远程 d11672f 不同 SHA 族）；工作区在 gitbutler/workspace 已对齐远程
- AMO 2026.9.12 占用未人工核对；Edge 包需人工更新 listing
- Pages Source 若仍为 Jekyll docs/，demo artifact 部署需人工切 GitHub Actions

## Backlog（待立票）

见 `docs/history/2026-09-12-backlog.md`
