# Ticket 60 — new-tab zero-flash slow-mo evidence (Chrome + Firefox)

> AC: Chrome+Firefox 新开标签慢放：无默认 beige、无亮暗跳变、无非记忆盒子可见帧。
> Per spec D-003: 自建证据目录，不勾进 G-B 六项（闪现不进 ADR-0017 门禁）。

## Capture procedure (per browser)

1. Load the built dist (or dev build) extension in the target browser.
2. Set a non-default theme (e.g. forest) + dark mode ON; create 2-3 boxes; close the tab.
3. Open a new tab; record with a screen recorder at 60fps (or use browser slow-mo / frame stepping in devtools Performance panel).
4. Frame-step the recording: EVERY visible frame must already show the remembered theme background — no default beige, no light->dark jump, no wrong-box visible frame (content is masked by html.boot-pending until render completes).

## Files

- (pending CI run) chrome/ — recording or frame captures from Chrome lane
- (pending CI run) firefox/ — recording or frame captures from Firefox lane
- capture-notes.md — per-run notes (build commit, browser version, frame-by-frame findings)

CI-only policy: runs are executed in CI/e2e lanes; local machine produces no build artifacts.
