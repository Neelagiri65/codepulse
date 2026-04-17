# DESIGN.md — CodePulse

Design system for the v0.1 leaderboard + paste-audit UI. All UI code references this file. Any component that contradicts these tokens is wrong — change the token, then the component.

**North stars:** World Monitor (information density, every pixel carries data), Linear (precision, restraint, typographic discipline).

**Anti-patterns:** AI-startup purple/blue gradients, hero sections, decorative illustrations, rounded-xl soft shadows, "delighter" micro-interactions.

---

## 1. Principles

1. **Data over decoration.** If removing an element doesn't remove information, remove the element.
2. **Monitoring, not marketing.** The site looks like something a developer leaves open in a tab, not something pitched on Product Hunt.
3. **Honest visual weight.** The histogram that shows "96% score 0" gets the same prominence as the ranked leaderboard. The data story is the product.
4. **Health is the accent.** Colour is a diagnostic signal (red → amber → green), never a brand flourish.
5. **Static, readable, no motion for motion's sake.** The only animations are the subtle data-refresh tick (sparkline cursor, refreshed-at timestamp). No page transitions, no fades, no parallax.

---

## 2. Colour

Dark theme only. No light-mode toggle in v0.1.

### 2.1 Surface

| Token | Hex | Use |
|---|---|---|
| `--bg-0` | `#0A0B0D` | Page background. Near-black, slightly warm. |
| `--bg-1` | `#111317` | Card / table row surface. |
| `--bg-2` | `#181B21` | Elevated (hover, header bar, textarea). |
| `--bg-3` | `#22262E` | Highest elevation (dropdown, selected row). |
| `--border` | `#262A32` | 1px dividers, table lines, card outlines. |
| `--border-strong` | `#3A3F4B` | Focus ring, active-sort indicator. |

### 2.2 Text

| Token | Hex | Use |
|---|---|---|
| `--fg-0` | `#E6E8EC` | Primary: data values, repo names, scores. |
| `--fg-1` | `#A6ADBB` | Secondary: column headers, field labels. |
| `--fg-2` | `#6B7280` | Tertiary: timestamps, hints, caption text. |
| `--fg-3` | `#4A5160` | Quaternary: disabled, dividers in text. |

### 2.3 Health gradient (the only accent)

Health score 0–100 maps to a single diverging ramp. Low score = healthy (green). High score = redundant/unhealthy (red). This is deliberately inverted from the "higher is better" convention because in CodePulse **a higher redundancy score is worse for the repo**. The histogram/ranked list must make that direction unambiguous via axis labels ("redundancy — lower is better").

| Token | Hex | Range | Meaning |
|---|---|---|---|
| `--health-0` | `#2DD4BF` | score 0–5 | Clean. Teal-green, not a pure-green "success" cliché. |
| `--health-1` | `#84CC16` | score 6–20 | Mostly clean. Lime. |
| `--health-2` | `#EAB308` | score 21–40 | Some redundancy. Amber. |
| `--health-3` | `#F97316` | score 41–65 | Notable redundancy. Orange. |
| `--health-4` | `#EF4444` | score 66–100 | Severe. Red. |

Use the health gradient only for score-derived surfaces (score pills, sparklines, histogram bars, score gauges). Never for navigation, chrome, or CTAs.

### 2.4 No-other-colours rule

There is no "primary brand colour," no purple, no indigo. Links and focus states are `--fg-0` on `--border-strong` outline. If you find yourself reaching for a blue, stop — use `--fg-0` and let typography carry the hierarchy.

---

## 3. Typography

Two families, both from system stacks. No web fonts in v0.1 (LCP budget).

```css
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### 3.1 Rule: mono for data, sans for labels

- **Mono** — every number, score, star count, char count, timestamp, repo name (`owner/name`), pattern ID, excerpt. Tabular figures mandatory (`font-variant-numeric: tabular-nums`).
- **Sans** — column headers, section titles, prose (the honest-data framing sentence), field labels, button text.

If in doubt: is it data the user will scan or compare? → mono.

### 3.2 Scale

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `--text-xs` | 11px / 16px | 500 | Table column headers, pill captions |
| `--text-sm` | 13px / 20px | 400 | Body default. Table cells. |
| `--text-base` | 15px / 22px | 400 | Section intro paragraphs. |
| `--text-lg` | 18px / 24px | 500 | Section titles (Leaderboard, Audit). |
| `--text-xl` | 22px / 28px | 500 | Large-number readouts (e.g. "186 repos scored"). |
| `--text-2xl` | 32px / 36px | 600 | The single hero stat at page top ("96% score 0"). |

No `font-weight` above 600. No italic. No letter-spacing tricks except `0.04em` tracking on `--text-xs` uppercase column headers.

### 3.3 Uppercase column headers

Table and card headers use `text-transform: uppercase; letter-spacing: 0.04em;` on `--text-xs` with `--fg-1`. This is the only uppercase rule in the system.

---

## 4. Spacing + layout

Base unit: **4px**. All padding/margin is a multiple of 4px.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Intra-token spacing (label→value in a card). |
| `--space-2` | 8px | Inline element gaps, icon+text. |
| `--space-3` | 12px | Table cell padding vertical. |
| `--space-4` | 16px | Default card padding, inline block spacing. |
| `--space-5` | 24px | Between cards in the same section. |
| `--space-6` | 32px | Between page sections. |
| `--space-8` | 48px | Page top/bottom. |

### 4.1 Grid

Page is a single 1200px max-width column, 24px gutters. No sidebars in v0.1. The histogram + leaderboard stack vertically on viewports below 1024px; they sit side-by-side (histogram 32%, leaderboard 68%) above that.

### 4.2 Radius

```css
--radius-sm: 2px;  /* pills, score chips */
--radius-md: 4px;  /* cards, inputs, buttons */
--radius-lg: 6px;  /* never used on v0.1, reserved */
```

No `border-radius: 12px+`. Soft rounded corners read as consumer-product. CodePulse is a panel.

### 4.3 Elevation

Flat. No drop shadows. Hierarchy is expressed via `--bg-0 → --bg-3` surface tokens and 1px `--border` lines. If you're tempted to add `box-shadow`, add a border instead.

---

## 5. Components

### 5.1 Hero stat block

The single most prominent element on the page. Displays the honest-data headline.

```
┌──────────────────────────────────────────────────────────────┐
│  CODEPULSE                             refreshed 04:48Z      │
│                                                              │
│  186 CLAUDE.md files measured · 96% clean                    │   ← --text-2xl, mono
│  median redundancy 0 · max 8 · catalogue v2                  │   ← --text-base, --fg-1
│                                                              │
│  Scored against 40 catalogue patterns —                      │   ← --text-sm, --fg-2
│  narrow scan, not a comprehensive audit. Methodology →       │     sans, link to
└──────────────────────────────────────────────────────────────┘     catalogue-authoring.md
```

- Background: `--bg-1`, border `--border`, radius `--radius-md`, padding `--space-5`.
- The headline number (`96%`) uses the health gradient token matching the *bucket* (`--health-0`).
- **Confidence caption** (the last line) is mandatory. It anchors the reader's interpretation of every score on the page: the distribution is bounded by catalogue coverage, not by the ecosystem. The catalogue count is injected at build time; the text after the em-dash is static prose. "Methodology" links to `docs/catalogue-authoring.md` on GitHub (external link, opens in new tab).

### 5.2 Distribution histogram

Vertical bars, one per score bucket (`0`, `1–25`, `26–50`, `51–75`, `76–100`).

- Bar width: 24px. Gap: 8px. Align to the left of the chart area.
- Bar fill: the `--health-N` token matching the bucket (bucket `0` uses `--health-0`, etc.). Bars start as `--bg-2` and reveal their health colour only where there are repos in that bucket — empty buckets show a 1px baseline tick in `--border`.
- Above each bar: repo count in mono `--text-sm` `--fg-0`.
- Below each bar: bucket label in sans `--text-xs` uppercase `--fg-1`.
- **No gridlines. No y-axis.** The numbers on top of the bars carry the scale.

### 5.3 Leaderboard table

Flat, borderless between rows except a 1px `--border` divider. Mono everywhere except column headers.

Columns (in order): **rank · owner/repo · stars · chars · score · matches · last commit**

- `rank`: 3-char right-aligned, `--fg-2`.
- `owner/repo`: mono `--fg-0`, truncated with ellipsis past 280px. Whole row is a link to `https://github.com/{owner}/{name}`.
- `stars`: mono tabular, right-aligned, `--fg-1`. Format: `1.2k`, `43.5k` (never full digits for ≥1000).
- `chars`: mono tabular, right-aligned, `--fg-2`.
- `score`: the **score pill** (see 5.4), fixed 56px width, right-aligned.
- `matches`: inline list of up-to-3 pattern IDs in mono `--text-xs` `--fg-1`, separated by `·`. Overflow: `+N more` in `--fg-2`.
- `last commit`: mono `--text-xs` `--fg-2`, relative format (`4d ago`, `3w ago`).

Row height: 36px. Hover: `--bg-2` background, cursor pointer. Sort controls live on the column header; the active sort column shows a ▲/▼ in `--border-strong`.

### 5.4 Score pill

The single reusable score primitive. Used in the leaderboard and the paste-audit scorecard.

```
┌──────┐
│  8   │    ← mono, tabular, --text-sm, colour = --health-N for bucket
└──────┘
    ▔▔     ← 2px underline, same health colour, full pill width
```

- Background: `--bg-2`. Text: the health token. 2px bottom border in the same health token.
- Width: 56px, height: 24px, radius `--radius-sm`. Centred content.
- Bucket mapping exactly matches §2.3.

### 5.5 Sparkline (deferred placeholder)

Reserved slot in the leaderboard for per-repo score trend when historical data exists. v0.1 shows a 1px `--border` baseline as the empty state — do not fake trend data.

### 5.6 Paste-audit card

Two-column layout above 900px, stacked below.

Left: textarea.
- Min height 320px, width 100%, padding `--space-4`.
- Background `--bg-2`, border `--border`, radius `--radius-md`, mono `--text-sm`.
- Focus: border becomes `--border-strong`. No glow.
- Placeholder in `--fg-3`: `Paste your CLAUDE.md here…`

Right: scorecard.
- Large score pill (56px → 88px variant) at top-left.
- Beneath the pill: `TOKEN COST` label + mono count.
- Matched-patterns list: each row is pattern ID (mono `--fg-0`) + weight pill (xs) + source-URL link icon. Excerpt below in `--fg-2` mono, truncated at 2 lines.
- Empty state (no paste yet): `--fg-3` text "Paste a CLAUDE.md to score it against the catalogue." centred vertically.
- Zero-matches state (clean paste): `--health-0` score pill showing `0`, and caption "No catalogued redundancy patterns matched. This config is clean against the current catalogue."

### 5.7 Page footer

Single line, mono `--text-xs` `--fg-2`:
`catalogue v2 · 40 patterns · scoring deterministic · source github.com/Neelagiri65/codepulse`

No nav, no legal links, no social icons.

---

## 6. Motion

- **No entrance animations.** The page renders.
- **Hover state:** 80ms background fade, that's it.
- **Sort change:** instant row reorder, no FLIP animation.
- **Refreshed-at timestamp:** a 1px `--health-0` dot pulses once every 60s (2s fade-in-out). This is the only ambient motion on the page and it signals "data is alive."

`prefers-reduced-motion: reduce` disables the dot pulse entirely.

---

## 7. Accessibility

- Contrast: all `--fg-0`/`--fg-1` on all backgrounds ≥ 7:1 (AAA). `--fg-2` ≥ 4.5:1 (AA body). `--fg-3` is decorative only (placeholder, dividers).
- Health colours all tested ≥ 4.5:1 against `--bg-1` and `--bg-2`.
- Every score pill has an `aria-label` of the form `redundancy score 8 of 100, mostly clean`.
- Histogram bars have `role="img"` with text alternatives; the count-above-bar is the authoritative readout.
- Focus ring: 2px outline `--border-strong`, 2px offset. Never remove.

---

## 8. What this system does not include (and why)

- **Light theme.** Monitoring dashboards live dark. Adding light-mode support doubles the test surface for zero product benefit at v0.1.
- **Icons beyond the external-link glyph.** Every icon is a visual distraction from numbers.
- **Gradients.** The health ramp is the only colour system; it's applied as discrete tokens, not as gradients.
- **Custom scrollbars.** System defaults.
- **A logo.** The wordmark `CODEPULSE` in mono is the logo.
