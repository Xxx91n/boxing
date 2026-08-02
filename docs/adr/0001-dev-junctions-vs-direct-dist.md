# Dev junctions (dev-chrome, dev-firefox) as GUI-load convenience layer

## Context

After introducing web-ext for CLI dev loading (commit ab436d7), we also needed a way for users to load the extension via browser GUI (chrome://extensions > Load unpacked, about:debugging > Load Temporary Add-on). The build output lives in dist/boxing-chrome and dist/boxing-firefox. Users could manually navigate there, but the nested path is error-prone.

## Decision

build.mjs creates NTFS junctions (symlinks on macOS/Linux) dev-chrome -> dist/boxing-chrome and dev-firefox -> dist/boxing-firefox at the project root after every build. Users load dev-chrome/ or dev-firefox/ in the browser GUI. web-ext (npm run dev:*) ignores junctions and points directly at dist/boxing-*.

## Rationale

Junctions cost zero storage (filesystem pointers), zero build coupling (build.mjs creates them as a post-step), and give users a short, stable path. Alternative was requiring users to navigate to dist/boxing-chrome/ every time. The junction layer is intentionally thin: if removed, web-ext still works, only GUI load convenience degrades.

## Consequences

- dev-chrome/ and dev-firefox/ are gitignored (junctions are machine-specific)
- build.mjs must run before GUI load (junctions do not exist until build creates them)
- On filesystems without junction support (rare), build.mjs falls back to symlink or silently skips
