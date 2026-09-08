# Ticket 34 Report — Multilingual README structure repair

- **Branch:** `ticket-34-readme-structure` (GitButler), commit `xst` — 12 locale files
- **Validator:** `node .scratch/architecture-recovery/34-locale-structure-check.mjs` (read-only, zero-dep, exit 0 = pass)
- **Date:** 2026-09-08 · **Scope:** `docs/i18n/README.*.md` + root `README.md` as baseline. No runtime code, no manifest, no dist surface touched (docs-only ticket; per ticket 15 precedent no build needed).

## 1. Method

English `README.md` is the structural baseline (ticket acceptance criterion 1). All 14 files were compared on four dimensions — title, headings, sections, links — by extracting headings/links/TOC per file, then repaired, then re-checked by a hand-written minimal structural validator (10 checks, C1-C10, persisted at `.scratch/architecture-recovery/34-locale-structure-check.mjs`).

## 2. Difference table (PRE-repair, evidence for launcher delta)

EN baseline sections: H1 Boxing → What Makes It Different → Screenshots → Brand Assets → Install (### Chrome/Edge, ### Firefox, TIP) → Usage (11 bullets) → Privacy (4 bullets) → Development (### Prerequisites, ### Setup, ### Build) → Quarantined tests (+ incident register) → Contributing → License.

| File | H1 | Shared sections present | Usage/Privacy state | TOC | Link defects |
|---|---|---|---|---|---|
| README.md | Boxing | all (baseline) | normal | none (selector only) | none found |
| ar, de, es, fr, ja, ko, pt_BR, ru | Boxing | TOC, Features, Install, Development, Contributing, License | **collapsed**: entire bullet list merged into one giant `##` line (238-666 chars) at L65/L79; bullet list duplicated below | 2 paragraph-sized entries + 5 English anchors (`#features`…) pointing at localized headings → all 7 broken | none beyond TOC |
| zh_TW | Boxing | same as above | **collapsed** (same shape) + **usage/privacy paragraphs inside TOC** + duplicated content (giant heading AND list below) | same 7 broken anchors | none beyond TOC |
| zh_CN | Boxing | TOC, 功能, 安装, 使用, 隐私, 开发, 贡献, 许可证 | normal | correct CJK anchors | `### 安装` (Setup) duplicates `## 安装` (Install) — mistranslation of EN "Setup" (zh_TW correctly has 設定) |
| hi | Boxing | TOC, Features, Install, Usage, Privacy, Development, Contributing, License (English headings, Hindi prose) | normal | correct anchors (headings are English) | none |
| th | Boxing | TOC, Thai sections, Usage, Privacy normal | normal | 7 English anchors vs Thai headings → all broken | 2 list items merged by literal ` n- ` artifact (Usage L68/L70, 9 bullets instead of 11) |
| vi | Boxing | TOC, Vietnamese sections normal | normal | 7 English anchors vs Vietnamese headings → all broken | none |

Totals: PRE validator run = **exit 1, 220 findings, 2/14 files pass** (only README.md and hi).

## 3. Repairs applied (POST state)

| File(s) | Change |
|---|---|
| ar, de, es, fr, ja, ko, pt_BR, ru, zh_TW | 2 collapsed `##` headings → real section titles; 2 paragraph-sized TOC entries → short entries; 5 TOC anchors retargeted to localized heading slugs. New titles (each file's own orthographic convention): ar الاستخدام/الخصوصية · de Verwendung/Datenschutz · es Uso/Privacidad · fr Utilisation/Confidentialite (file is written unaccented) · ja 使い方/プライバシー · ko 사용법/개인정보 · pt_BR Uso/Privacidade · ru Использование/Конфиденциальность · zh_TW 使用/隱私 |
| th | 2 ` n- ` merged list items split (Usage back to 11 bullets); 7 TOC anchors retargeted to Thai slugs |
| vi | 7 TOC anchors retargeted to Vietnamese slugs |
| zh_CN | `### 安装` → `### 设置` under Development (removes duplicate section name, mirrors EN "Setup") |
| hi | none needed |
| README.md | none (baseline untouched) |

No bullet list, sentence, or image was deleted; repairs touch only heading lines, TOC lines, and anchors. `git diff --stat`: 12 files, 100 insertions / 98 deletions.

## 4. Acceptance criteria evidence

1. **English headings as baseline without deleting language-specific content** — validator C4 (required section sequence in EN order) + C6 (Usage = 11 bullets, Privacy = 5 in every locale vs EN's 4 — locales carry an extra "100% open source" bullet, kept as language-specific content) pass on all 14; diff touches headings/TOC only.
2. **zh_TW clean** — POST zh_TW has exactly one `## 使用` and one `## 隱私`; TOC contains 7 short entries with CJK anchors; the usage/privacy paragraphs are gone from the TOC (diff hunks in commit `xst`).
3. **Language selector links resolve** — validator C9: every file's selector has exactly 14 links (13 languages + TRANSLATIONS.md), every target exists on disk and is git-tracked (selector of locales uses `../../README.md`, sibling filenames, `../../TRANSLATIONS.md`; root uses `docs/i18n/…`).
4. **Install/privacy/contribution/license links resolve** — C7: all relative targets exist and are tracked: `../../docs/privacy-policy.md`, `../../CONTRIBUTING.md`, `../../LICENSE`, `../../docs/store-assets/screenshots/*.png`, `docs/privacy-policy.md`, `CONTRIBUTING.md`, `LICENSE`. Install links are the GitHub releases URL (external); its release-list emptiness is ticket 35/37's publication-truth surface, deliberately not re-verified here.
5. **Omitted English-only sections recorded** — §5 below.

**Validation commands + results**

- `node .scratch/architecture-recovery/34-locale-structure-check.mjs` → PRE: exit 1, 220 findings; POST: exit 0, **14/14 pass, 0 findings**. Checks: C1 single H1; C2 no collapsed heading (>80 chars); C3 unique heading titles; C4 required sections in EN order (incl. 5 subsections); C5 TOC entries short (≤60 chars) + anchors resolve; C6 bullet counts; C7 all relative links exist + tracked; C8 all in-page anchors resolve; C9 selector completeness; C10 no ` n- ` artifact.
- `git diff --check` → clean. CRLF scan (`git ls-files -- docs/i18n | xargs grep -lU \`r\`) → none (LF preserved).

## 5. Intentionally omitted English-only sections (keep/remove rationale — NOT force-copied into locales)

| EN section | Decision | Rationale |
|---|---|---|
| `## Screenshots` (5-image store grid) | omit from locales | Launcher forbids force-copying English store sections; locales already embed screenshot-1 + screenshot-2 inline; ticket 36 will replace the PNGs with fresh English captures, so duplicating the grid in 13 files adds no localized value |
| `## Brand Assets` | omit | Contributor/marketing asset-vendoring note (`docs/brand/`), no localized-reader value |
| `## Quarantined tests` + incident register | omit | Internal QA governance with 30-day churn; English-only maintainer audience |
| Hero nav links + release/store badges | omit | Publication-status claims (store rollout, Edge badge) are ticket 37's reconciliation surface; locales must not embed them before truth is settled |
| EN "What Makes It Different" vs localized "Features" naming | keep localized naming | Same content and structural role, natural localized title; renaming would churn 13 files for zero reader value |
| Locale TOC section (absent in EN) | keep | Language-specific navigation aid; retained but structurally repaired |
| hi English section headings | keep | TRANSLATIONS.md guideline: "If a section is hard to translate, keep the English version"; anchors already correct |

## 6. Process notes

- The anchor fixer's first version had a silent no-op: replacement string omitted `#`, so `String.replace` returned the line unchanged while a counter claimed success. The validator's C7 caught it immediately (entries became relative links); fixed same-session with a strict verify-after-write pass. Recorded for WORKFLOW §6 promotion by the brain window: *verify String.replace results explicitly — a no-op replace must abort, not increment.*
- Per handoff instruction the report was committed only after the change commit existed.

## 7. Out-of-scope observations (for the brain window)

- EN links into `.scratch/architecture-recovery/18|27|31-…report.md` resolve to tracked files — OK.
- th prose quality (e.g. พ่อ for "parent") is a translation-content matter, untouched per scope.
- Release-page emptiness and store-URL claims: tickets 35/37.
