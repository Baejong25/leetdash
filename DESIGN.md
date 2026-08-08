# LeetDash Design System

Extracted from the existing dashboard implementation (`app/globals.css`, `app/layout.tsx`, and component files). This document is the single source of truth for all visual decisions. Every token is traceable to existing CSS.

## 1. Atmosphere & Identity

A compact, data-dense study-progress dashboard. The signature is the teal accent (`#0f766e`) against a cool gray backdrop — precise, unpretentious, and functional. Cards sit on a 1280px-centered page with mixed borders and a single subtle shadow, creating depth without decoration. Korean-language UI with Lucide iconography throughout.

## 2. Color

### Palette

All colors are light-only. No dark mode tokens exist; do not invent them.

| Role | Token | Light | Usage |
|------|-------|-------|-------|
| Background | `--bg` | `#f6f7f9` | Page background |
| Surface/primary | `--surface` | `#ffffff` | Cards, panels, stat boxes |
| Surface/muted | `--surface-muted` | `#eef1f4` | Progress bar track, neutral badges, hover bg |
| Text/primary | `--text` | `#18202a` | Body text, headings, brand |
| Text/secondary | `--muted` | `#637083` | Captions, labels, subdued text |
| Border/default | `--border` | `#d9dee7` | Card borders, table cell dividers |
| Border/strong | `--strong-border` | `#b9c2cf` | Button borders, select borders |
| Accent/primary | `--accent` | `#0f766e` | CTAs, links, focus outlines, bar fills, eyebrow |
| Accent/strong | `--accent-strong` | `#0b5f59` | Primary button hover, link hover, active sort |
| Accent/soft | `--accent-soft` | `#d9f4ef` | Focus ring, activity-level-1 |
| Status/warning | `--warn` | `#a16207` | Reviewing/running badge text |
| Status/warning-soft | `--warn-soft` | `#fef3c7` | Reviewing/running badge background |
| Status/error | `--danger` | `#b42318` | Skipped/failed badge text |
| Status/error-soft | `--danger-soft` | `#fee4e2` | Skipped/failed badge background |
| Status/success | `--ok` | `#147c3f` | Solved/success badge text |
| Status/success-soft | `--ok-soft` | `#dcfce7` | Solved/success badge background |
| Shadow | `--shadow` | `0 10px 30px rgba(26,35,48,0.08)` | Single shadow for cards, panels, stats |

### Known Inconsistencies (do not propagate)

These hardcoded values exist in `app/globals.css` but are NOT design tokens. New code must not use them; extend the palette above instead.

| Location | Hardcoded Value | Recommendation |
|----------|----------------|----------------|
| `.shell-header` background | `rgba(255,255,255,0.92)` | Consider `--surface` with opacity; low priority |
| `th`, `.section-row td`, `.catalog-panel-toggle:hover` | `#fbfcfd` | Could become `--surface-header` token |
| `.dashboard-tab-button[aria-selected="true"]` color | `#ffffff` | Already equivalent to white-on-accent; acceptable |
| `.dashboard-tab-button[aria-selected="true"] small` | `rgba(255,255,255,0.82)` | Tab-active-muted token candidate |
| `.problem-row-target:target td` | `#f0faf8` | Could become `--accent-highlight` token |
| Activity heatmap levels 1–3 | `#b5e9df`, `#8dded2`, `#69cfc2`, `#35a79a`, `#278c81` | Could become `--activity-level-*` tokens |

### Rules

- Accent (`--accent`) is used for interactive elements and data emphasis only. Never decorative.
- Status colors are consumed exclusively through `.badge` variants. Do not use them for borders, backgrounds, or text elsewhere.
- All new colors must become CSS custom properties first, then documented here. No raw hex in CSS after this file exists.

## 3. Typography

### Font Stack

- **Primary:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Mono:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (used via `.mono` class)
- **Serif:** Not used

### Scale

| Level | Class/Tag | Size | Weight | Line Height | Letter-Spacing | Usage |
|-------|-----------|------|--------|-------------|----------------|-------|
| Display | `h1` | 32px | 700 (inherited) | 1.15 | 0 | Page title |
| Heading 2 | `h2` | 20px | 700 (inherited) | 1.2 | — | Section headers, panel titles |
| Heading 3 | `h3` | 16px | 700 (inherited) | 1.2 | — | Card titles, list-card headings |
| Body/lede | `.lede` | 15px | 400 (inherited) | 1.55 | — | Page description paragraphs |
| Body | `html` (default) | 16px | 400 | 1.2–1.6 (browser) | — | Default content |
| Stat value | `.stat-value` | 28px | 780 | 1 | — | Large stat numbers |
| Snapshot value | `.snapshot-value` | 18px | 400 (inherited) | 1.2 | — | Smaller stat display |
| Small/utility | `.panel-subtitle`, `.stat-label` | 13px | 400 (inherited) | — | — | Subtitles, stat descriptions |
| Caption | `th`, `.section-row td`, `.eyebrow`, `.filter-label`, `.field label` | 12px | 760 | — | — | Table headers, section labels, form labels |
| Badge | `.badge` | 12px | 740 | — | — | Status badges |
| Mono label | `.mono` | 12px | 400 | — | — | GitHub handles, filenames |
| Nav link | `.top-nav a` | 14px | 400 (inherited) | — | — | Header navigation |
| Brand | `.brand` | 16px | 760 | — | — | Site title in header |

### Font Weight Tokens Observed

`640` (light emphasis), `680` (semi-bold: button, problem-title, problem-link), `740` (badge), `760` (bold: brand, eyebrow, th, checkbox label), `780` (stat-value, extra-bold). These are intentional gradations; preserve them.

### Rules

- Max 2 font families: Inter (primary) + system monospace.
- Uppercase text-transform is restricted to `.eyebrow`, `th`, `.section-row td`, `.filter-label`, and `.field label`. Do not use uppercase elsewhere.
- `.mono` is 12px only. No other mono sizes exist in the current system.

## 4. Spacing & Layout

### Base Unit

The system is built around a **4px** base, though several existing values deviate (flagged below). All new spacing must be a multiple of 4px.

### Token Map (Existing Values)

| Value | Where Used | Conforms to 4px? |
|-------|-----------|-------------------|
| 4px | `.activity-summary` gap, `.dashboard-tab-button` gap | Yes |
| 6px | `.dashboard-tab-list` gap, `.catalog-panel-toggle` gap, `.table-sort-button` gap, `.field` gap | **No** |
| 7px | `.top-nav a` gap, `.progress-meta` margin-bottom | **No** |
| 8px | `.top-nav` gap, `.viewer-control` gap, `.filter-bar .viewer-control` gap, `.button` gap, `.brand` gap, `.eyebrow` margin-bottom, `h1` margin-bottom, `.stat-label` margin-bottom, `.list-card h3` margin-bottom, `.checkbox-row` gap | Yes |
| 9px | `.top-nav a` padding-block, `.dashboard-tab-button` padding-block | **No** |
| 10px | `.actions` gap, `.brand` gap, `.shell-header` gap (mobile), `h3` margin-bottom, `.top-nav a` padding-inline | **No** |
| 11px | `.dashboard-tab-button` padding-inline, `.viewer-control select` padding-inline | **No** |
| 12px | `.filter-bar` gap, `.form-grid` gap, `.button` padding-inline | Yes |
| 13px | `th`/`td` padding-block | **No** |
| 14px | `.stats-grid`/`.list-grid` gap, `h2` margin-bottom, `th`/`td` padding-inline, `.recent-submission-item` gap, `.activity-user-row` gap, `.recent-submission-item` padding-block, `.activity-user-row` padding-block, `.shell-header` padding-block (mobile) | **No** |
| 16px | `.panel-header` gap, `.activity-user-row` gap, `.stat` padding, `.list-card` padding | Yes |
| 18px | `.panel` margin-bottom, `.filter-bar` margin-bottom, `.panel-header` padding-inline, `.catalog-panel-toggle` padding-block, `.filter-bar` padding-inline, `.recent-submission-item` padding-inline, `.form-grid` padding, `.my-profile-picker` padding, `.activity-detail-calendar` padding, `th` padding-inline in some contexts, `.dashboard-tabs` gap | **No** |
| 20px | `.list-grid` margin-bottom, `.stats-grid` margin-bottom | Yes |
| 24px | `.page-header` margin-bottom, `.page-header` gap, `.page` padding-block (mobile) | Yes |
| 28px | `.empty` padding-block | Yes |
| 30px | `.page` padding-block (desktop) | **No** |
| 32px | `.shell-header` padding-inline, `.page` padding-inline | Yes |
| 42px | `.page` padding-bottom (mobile) | **No** |
| 52px | `.page` padding-bottom (desktop) | Yes |

### Grid

- **Max content width:** 1280px (`.page`)
- **Breakpoints:** `max-width: 640px` (mobile stack), `max-width: 900px` (tablet stack)
- **Header:** sticky, min-height 64px, `backdrop-filter: blur(16px)`, `z-index: 10`
- **Stat grid:** 4 columns → 1 column at ≤900px
- **List grid:** 3 columns → 1 column at ≤900px
- **Form grid:** 4 columns → 1 column at ≤900px
- **Dashboard tab list:** 4 columns → 2 columns at ≤900px

### Rules

- New spacing values must be multiples of 4px. Existing deviations (6, 7, 9, 10, 11, 13, 14, 18, 30, 42) are legacy and should not be extended.
- When adding a spacing value that doesn't exist as a CSS custom property, define a new `--space-*` variable first.
- Page-level horizontal padding is 32px (desktop) / 18px (mobile).

### Future Comparison Page Layout

The comparison page will use a code-first split view at ≥901px and a single-column stack at ≤900px, consistent with the existing breakpoint system. Its max width is 1280px, matching `.page`.

## 5. Components

### Shell Header (`.shell-header`)
- **Structure:** `<header>` with `.brand` (left) and `.top-nav` (right)
- **States:** Sticky on scroll, backdrop-blurred, z-10
- **Spacing:** min-height 64px, padding 0 32px (desktop) / 14px 18px (mobile)
- **Accessibility:** `aria-label="주요 내비게이션"` on nav

### Brand (`.brand`)
- **Structure:** `<Link>` with Lucide icon + span
- **Typography:** 16px, weight 760, color `--text`
- **Spacing:** gap 10px

### Top Nav (`.top-nav`)
- **Structure:** Flex row, gap 8px
- **Link states:** default (`--muted`), hover (background `--surface-muted`, color `--text`)
- **Link style:** border-radius 6px, padding 9px 10px, gap 7px, 14px font

### Button (`.button`, `button`)
- **Structure:** Inline flex, gap 8px, min-height 38px, padding 8px 12px
- **Variants:** Default (surface bg, `--strong-border` border), Primary (`.primary` — `--accent` bg, white text)
- **States:** Default, hover (border-color → `--accent`), primary hover (bg → `--accent-strong`)
- **Typography:** weight 680
- **Border radius:** 6px

### Panel (`.panel`)
- **Structure:** Section wrapper with header + body
- **Style:** `--surface` background, 1px `--border` border, border-radius 8px, box-shadow `--shadow`
- **Spacing:** margin-bottom 18px, overflow hidden

### Panel Header (`.panel-header`)
- **Structure:** Flex row, justify-between, border-bottom 1px `--border`
- **Spacing:** padding 16px 18px, gap 16px

### Stat Card (`.stat`)
- **Style:** `--surface`, border 1px `--border`, border-radius 8px, padding 16px, box-shadow `--shadow`
- **Child elements:** `.stat-label` (13px, `--muted`), `.stat-value` (28px, weight 780)
- **Grid:** 4-col in `.stats-grid`, collapses to 1-col at ≤900px

### List Card (`.list-card`)
- **Style:** Same surface treatment as `.stat`
- **Purpose:** Linked card for catalog list summaries
- **Child elements:** `h3`, `.progress-meta` + `.bar`

### Data Table
- **Wrapper:** `.table-wrap` (overflow-x auto)
- **Table:** min-width 900px, border-collapse
- **Header:** `th` — background `#fbfcfd`, color `--muted`, 12px, weight 760, uppercase, padding 13px 14px
- **Cell:** `td` — padding 13px 14px, border-bottom 1px `--border`, last child no border
- **Section row:** `.section-row td` — background `#fbfcfd`, 12px, weight 760, uppercase
- **Target row:** `.problem-row-target` — scroll-margin-top 96px, `:target td` background `#f0faf8`, first td gets inset 3px 0 0 `--accent`
- **Sort button:** `.table-sort-button` — transparent bg, 12px, uppercase, hover color `--accent-strong`

### Badge (`.badge`)
- **Style:** Pill shape (border-radius 999px), inline-flex, 12px, weight 740, padding 3px 9px, min-height 24px
- **Variants:**
  - `.solved` / `.success` → `--ok-soft` bg, `--ok` text
  - `.reviewing` / `.running` → `--warn-soft` bg, `--warn` text
  - `.skipped` / `.failed` → `--danger-soft` bg, `--danger` text
  - `.neutral` → `--surface-muted` bg, `--muted` text

### Progress Bar (`.bar` + `.bar-fill`)
- **Track:** `--surface-muted` bg, border-radius 999px, height 8px
- **Fill:** `--accent` bg, height 100%, width set via inline style

### Dashboard Tabs (`.dashboard-tabs`)
- **Tab list:** `.dashboard-tab-list` — `--surface` bg, border 1px `--border`, border-radius 8px, 4-col grid, gap 6px, padding 6px, box-shadow `--shadow`
- **Tab button:** `.dashboard-tab-button` — flex-col, gap 4px, min-height 58px, padding 9px 11px, transparent border
- **Active tab:** `[aria-selected="true"]` — `--accent` bg, white text
- **Accessibility:** `role="tablist"`, `role="tab"`, `aria-selected`

### Form Controls
- **Select:** `.viewer-control select` — custom arrow via CSS gradients, min-height 38px, min-width 180px (130px in filter bar), padding 8px 32px 8px 11px, border 1px `--strong-border`, border-radius 6px, weight 680
- **Focus:** border-color `--accent`, outline 2px `--accent-soft`
- **Input:** `.field input` — border 1px `--border`, border-radius 6px, min-height 38px, padding 8px 10px
- **Focus:** border-color `--accent`, outline 2px `--accent-soft`

### Activity Calendar (`.activity-calendar`)
- **Grid:** Flex wrap, gap 4px
- **Cell:** `.activity-day` — 14px × 14px, border 1px `--border`, border-radius 3px
- **Levels:** 0 (`--surface-muted`), 1 (`--accent-soft`, border `#b5e9df`), 2 (`#8dded2`, border `#69cfc2`), 3 (`#35a79a`, border `#278c81`), 4 (`--accent`, border `--accent-strong`)
- **Note:** Levels 1–3 use hardcoded hex; file as known inconsistency.

### Recent Submission List (`.recent-submission-list`)
- **Item:** Grid with columns minmax(180px, 0.9fr) minmax(260px, 1.5fr) minmax(120px, auto), padding 14px 18px, gap 14px, border-bottom 1px `--border`

### Activity User Row (`.activity-user-row`)
- **Grid:** minmax(190px, 1.1fr) minmax(280px, 4fr) minmax(140px, auto), padding 14px 18px, gap 16px, border-bottom 1px `--border`

### User Cell (`.user-cell`)
- **Min-width:** 220px
- **Child:** `.user-name` (weight 760, display block, margin-bottom 4px; `.compact` variant: 2px)

### Catalog Panel (collapsible)
- **Toggle:** `.catalog-panel-toggle` — full-width button, padding 16px 18px, gap 6px, text-align left
- **Hover:** background `#fbfcfd`
- **Focus-visible:** outline 2px `--accent`, outline-offset -2px
- **Chevron:** `.catalog-chevron` — transition transform 0.2s ease; `.open` rotates 90deg
- **Body:** `.catalog-panel-body` — grid-template-rows 0fr → 1fr, transition 0.25s ease
- **Accessibility:** Toggle button must have `aria-expanded`

### Empty State (`.empty`)
- **Style:** `--muted` color, centered text, padding 28px 18px

### Utility Classes
- `.sr-only` — screen-reader-only text
- `.muted` — applies `var(--muted)` color
- `.mono` — applies monospace font, 12px
- `.lede` — lead paragraph: 15px, `--muted`, max-width 760px, line-height 1.55
- `.eyebrow` — 12px, weight 760, `--accent`, uppercase, margin 0 0 8px
- `.github-link` — hover: `--accent-strong`, underline, text-underline-offset 3px

### Future Comparison Primitives (Section 5 extension)

These components will be built in later tasks. Define their token contract here; do not implement styling with ad-hoc values.

#### Code Surface
- **Purpose:** Displays selected solution source code with line numbers.
- **States:** loading (skeleton/fade), loaded (code visible), error (fetch failure message), empty (no solution selected), oversized (≥256 KiB — show first 256 KiB + truncation notice).
- **Tokens:** Uses `--surface` background, `--border` dividers. Line numbers in `--muted` mono. Code text in `--text` mono. Selected/focused line highlight via `--accent-soft`.
- **Scroll:** Horizontal scroll for long lines; container must not overflow the page. Vertical scroll with sticky header.
- **Accessibility:** Semantic `<pre><code>`, ARIA live region for loading/error state changes.

#### Solver Selector
- **Purpose:** Dropdown or segmented control to pick which user's solution to view.
- **States:** default (shows navigated user), empty (user has no solution — show message, offer solvers), expanded (dropdown open).
- **Tokens:** Matches existing `.viewer-control select` pattern — border, radius, focus ring, min-height 38px.
- **Accessibility:** `<label>` association, focus management.

#### Review Item
- **Purpose:** Displays matched review comment for the current code.
- **States:** absent (no review exists), matched (review shown), stale (path/content hash mismatch — show "리뷰 동기화 불가"), sync-unavailable (deploy-time sync failed — show notice distinct from "no review").
- **Tokens:** Uses `--surface-muted` background, `--border` separator. Reviewer attribution in `--muted` size. Review body in `--text`.
- **Accessibility:** ARIA live region for state transitions.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Chevron rotate | 200ms | ease | Catalog accordion toggle |
| Accordion expand | 250ms | ease | Catalog panel body `grid-template-rows` |

### Current Transitions
- `.catalog-chevron` → `transition: transform 0.2s ease` (rotate 0° → 90°)
- `.catalog-panel-body` → `transition: grid-template-rows 0.25s ease` (0fr → 1fr)

### Focus States (Existing)

| Element | Focus Style |
|---------|------------|
| `.catalog-panel-toggle` | `outline: 2px solid var(--accent)`, `outline-offset: -2px` (focus-visible only) |
| `.viewer-control select` | `border-color: var(--accent)`, `outline: 2px solid var(--accent-soft)` |
| `.field input` | `border-color: var(--accent)`, `outline: 2px solid var(--accent-soft)` |

### Hover States (Existing)

| Element | Hover Style |
|---------|------------|
| `.top-nav a` | `background: var(--surface-muted)`, `color: var(--text)` |
| `.button` / `button` | `border-color: var(--accent)` |
| `.button.primary` / `button.primary` | `background: var(--accent-strong)` |
| `.table-sort-button` | `color: var(--accent-strong)` |
| `.github-link` | `color: var(--accent-strong)`, underline |
| `.catalog-panel-toggle` | `background: #fbfcfd` |

### Interaction Rules

- Only animate `transform` and `opacity`. The existing `grid-template-rows` transition for accordion is an exception — use `grid-template-rows` only for height-animation patterns; prefer `transform` for all new motion.
- Every interactive element must have visible focus, hover, and active states.
- Respect `prefers-reduced-motion` — disable non-essential animations.
- The page-level `scroll-behavior` is unset (browser default instant scroll). Do not add `scroll-behavior: smooth` globally.

## 7. Depth & Surface

### Strategy: Mixed (Borders + Single Shadow)

The dashboard uses ONE shadow across all elevated surfaces, paired with a hairline border.

- **Border:** `1px solid var(--border)` on panels, stats, cards, tab lists, form inputs
- **Shadow:** `var(--shadow)` — `0 10px 30px rgba(26, 35, 48, 0.08)` — applied to panels, stats, list cards, dashboard tab list
- **Stronger border:** `1px solid var(--strong-border)` on buttons and selects

### Depth Levels (Implicit)

| Level | Treatment | Applied To |
|-------|-----------|------------|
| Flat (page bg) | `--bg` only | Body background |
| Subtle raised | `--surface` + 1px `--border` | Table cells, form inputs at rest |
| Elevated | `--surface` + 1px `--border` + `--shadow` | Panels, stat cards, list cards, tab list |
| Floating (header) | `rgba(255,255,255,0.92)` + blur + 1px `--border` bottom + z-10 | Sticky shell header |

### Rules

- All elevated surfaces MUST receive both border AND shadow. This is the project's depth signature.
- Never use shadow without a border, or border without shadow for cards.
- The header is the only element with backdrop-filter blur. Do not add blur to other surfaces.
- Do not add additional shadow levels. One shadow (`--shadow`) is sufficient.

---

## Appendix A: CSS Custom Property Audit

Every `:root` custom property from `app/globals.css` (lines 1–18):

| Property | Value | Documented |
|----------|-------|-----------|
| `--bg` | `#f6f7f9` | Section 2 |
| `--surface` | `#ffffff` | Section 2 |
| `--surface-muted` | `#eef1f4` | Section 2 |
| `--text` | `#18202a` | Section 2 |
| `--muted` | `#637083` | Section 2 |
| `--border` | `#d9dee7` | Section 2 |
| `--strong-border` | `#b9c2cf` | Section 2 |
| `--accent` | `#0f766e` | Section 2 |
| `--accent-strong` | `#0b5f59` | Section 2 |
| `--accent-soft` | `#d9f4ef` | Section 2 |
| `--warn` | `#a16207` | Section 2 |
| `--warn-soft` | `#fef3c7` | Section 2 |
| `--danger` | `#b42318` | Section 2 |
| `--danger-soft` | `#fee4e2` | Section 2 |
| `--ok` | `#147c3f` | Section 2 |
| `--ok-soft` | `#dcfce7` | Section 2 |
| `--shadow` | `0 10px 30px rgba(26,35,48,0.08)` | Section 2 |

**Result:** 17/17 `:root` custom properties documented.

---

## Appendix B: Icon Set

All icons come from **Lucide React** (`lucide-react`). Currently used:
- `BarChart3` (brand, dashboard nav)
- `GitFork` (GitHub link)
- `UserRoundCheck` (my-profile nav)
- `Users` (admin nav)
- `Clock3` (recent submissions panel)
- `ArrowDownWideNarrow` / `ArrowUpNarrowWide` (sort indicators)

All icons use `aria-hidden="true"`.
