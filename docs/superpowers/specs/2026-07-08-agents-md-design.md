# agent.md Boundary and Implementation Spec

Date: 2026-07-08
Project root: `D:\Aworker\crx`
Primary reader: future AI coding agents working on browser extensions in this project.

## 1. Deliverables

| Deliverable | Path | Purpose | Status |
|---|---|---|---|
| General browser-extension agent guide | `D:\Aworker\crx\agent.md` | Project-local CRX/browser-extension development skeleton | Created |
| Qlearly project agent guide | `D:\Aworker\crx\qlearly_bookmark-0.0.2\agent.md` | Full general skeleton plus Qlearly project specialization | Created |
| Design and planning spec | `D:\Aworker\crx\docs\superpowers\specs\2026-07-08-agents-md-design.md` | Boundary, exclusions, plan/status tables, and implementation record | This file |

## 2. Boundary corrections from user review

| Correction | Final decision |
|---|---|
| Three deliverables total | Two `agent.md` files plus this spec file. |
| Root `agent.md` purpose | General skeleton for browser-extension development using locally available CRX-relevant capabilities. |
| Project `agent.md` purpose | Full root skeleton plus Qlearly-specific project/aesthetic/source-structure specialization. |
| Qlearly six-step plan | Belongs in this spec, not in either `agent.md`. |
| Status board | Belongs in this spec, not in either `agent.md`. |
| skm/opencode management details | Removed from `agent.md`; these are tool-management concerns, not CRX workflow rules. |
| Non-CRX content | Excluded from both `agent.md` files. |

## 3. Content explicitly excluded from both agent.md files

| Excluded content | Reason |
|---|---|
| Full skm skill inventory | Skill-manager state is not CRX workflow content. |
| Full opencode MCP inventory | MCP-manager state is not CRX workflow content. |
| skm install command syntax | Tool installation/management detail, not persistent CRX workflow. |
| opencode mcp add syntax | Tool installation/management detail, not persistent CRX workflow. |
| Chrome DevTools MCP installation flags | Tool installation/management detail; agent docs should mention capability, not manager config. |
| Historical WXT/Plasmo/CRXJS comparison | Decision history, not operating rule. |
| Non-CRX tools: docx, pdf, pptx, aihot, khazix, maya, omniroute, exa, perplexity, codegraph | Not browser-extension development workflow content. |
| Qlearly six-step implementation plan | Planning content belongs in this spec. |
| Installed/not-installed/ongoing status board | Planning/status content belongs in this spec. |

## 4. Content allowed in root `agent.md`

Root `agent.md` may include only stable CRX-development rules and capability usage guidance.

| Section | Required content |
|---|---|
| `# Browser Extension Agent Guide` | Scope statement. |
| `## Applicability` | Browser-extension work under `D:\Aworker\crx`. |
| `## Hard Rules` | MUST/MUST NOT rules for Manifest, dependencies, UI, runtime validation, Chrome+Firefox compatibility. |
| `## Approved CRX Capabilities` | Capability-level descriptions only: extension guidance, modern web guidance, frontend design guidance, browser runtime validation, cross-browser validation, WXT. |
| `## WXT Usage Recipes` | WXT commands only because WXT is a CRX framework. |
| `## Build and Verification` | CRX build/load/visual validation instructions. |
| `## UI/Aesthetic Workflow` | CRX UI workflow: visual direction, modern CSS, CSS variables, Shadow DOM/isolation, screenshot/console validation. |
| `## Forbidden Defaults` | shadcn/Tailwind/Figma/Plasmo/React/Vue/cloud automation are not defaults. |
| `## Known CRX Development Traps` | Only CRX-relevant traps: non-scaffold unpacked project, WXT flag, pnpm WXT fallback, MV2 legacy. |

## 5. Content required in Qlearly project `agent.md`

Qlearly `agent.md` must contain the entire root `agent.md` content first, then append project specialization.

| Section | Required content |
|---|---|
| `# Qlearly Project Specialization` | Separator for project-specific rules. |
| `## Applicability` | Path, extension name/version, manifest version, browsers, UI surfaces, target style. |
| `## Project Facts` | Existing newtab/popup/options files, CSS/JS state, non-WXT scaffold state, OAuth limitation. |
| `## Qlearly Hard Rules` | Preserve bookmark cards, use CSS tokens, avoid framework/dependency defaults, keep newtab override. |
| `## CSS Token Baseline` | Beige modern minimal token table. |
| `## Source Layout` | File roles and safe edit guidance. |
| `## Safe Modification Rules` | Dependency, framework, MV3, rendering, store metadata rules. |
| `## Validation Rules` | Chrome load, Firefox load, new tab, popup, options, visual inspection. |

## 6. Qlearly implementation plan table

This plan table is intentionally kept in this spec and must not be copied into `agent.md` files.

| Step | Title | Files likely touched | Success signal |
|---:|---|---|---|
| 1 | Extract CSS tokens | `ntp/ntp.css`, possibly `popup/popup.css`, `options/options.css` | Token table exists; hard-coded beige colors reduced. |
| 2 | Add bookmark data layer | `ntp/ntp.js`, `manifest.json` permissions | Reads `chrome.bookmarks.getTree()` or browser-compatible equivalent. |
| 3 | Rewrite NTP render layer | `ntp/ntp.js`, `ntp/index.html`, `ntp/ntp.css` | NTP renders bookmark boxes/cards from real data. |
| 4 | Enable popup/options selectively | `popup/*`, `options/*` | Popup/options no longer empty if included in scope. |
| 5 | MV2 to MV3 migration | `manifest.json`, `background.js` | Chrome loads unpacked MV3; Firefox behavior considered. |
| 6 | Visual/runtime verification | Browser runtime tooling/manual browser checks | Screenshots/console review confirm beige minimal layout and no console errors. |

## 7. Status board

This status board is intentionally kept in this spec and must not be copied into `agent.md` files.

| Item | Status | Notes |
|---|---|---|
| Root `agent.md` | Created | `D:\Aworker\crx\agent.md` |
| Qlearly `agent.md` | Created | `D:\Aworker\crx\qlearly_bookmark-0.0.2\agent.md` |
| Root guide excludes skm/opencode management details | Verified | No `skm`, no `opencode` terms in root guide. |
| Qlearly guide inherits root guide | Verified | `qlearly_bookmark-0.0.2\agent.md` starts with root guide content. |
| Qlearly six-step plan | Planned only | This spec contains the table; not copied into agent files. |
| Qlearly UI implementation | Not started | Future task. |

## 8. Current file shape summary

### Root `agent.md`

```markdown
# Browser Extension Agent Guide

## Applicability
## Hard Rules
## Approved CRX Capabilities
## WXT Usage Recipes
## Build and Verification
## UI/Aesthetic Workflow
## Forbidden Defaults
## Known CRX Development Traps
```

### Qlearly `agent.md`

```markdown
# Browser Extension Agent Guide
...
## Known CRX Development Traps

---

# Qlearly Project Specialization

## Applicability
## Project Facts
## Qlearly Hard Rules
## CSS Token Baseline
## Source Layout
## Safe Modification Rules
## Validation Rules
```

## 9. Validation checklist

| Check | Expected |
|---|---|
| Root guide exists | `True` |
| Qlearly guide exists | `True` |
| Qlearly guide starts with root guide | `True` |
| Root guide contains no `skm` term | `True` |
| Root guide contains no `opencode` term | `True` |
| Root guide contains no non-CRX tool names | `True` |
| Qlearly guide contains CSS tokens | `True` |
| Qlearly guide does not include six-step implementation plan table | `True` |
