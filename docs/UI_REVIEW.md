# Interface review: HeatShield Mumbai dashboard

Run with the `better-interface` process and its domain skills (`better-accessibility`, `better-layout`,
`better-writing`, `better-typography`, `better-colors`, `better-ui`), plus the `design-review` rubric.
Findings were fixed in the same pass; this records what was found and how it was verified.

## Scope and coverage

**Scope:** the whole dashboard (8 pages, shell, mobile drawer, presentation mode), in light and dark mode,
at 1440 px, 640 px (≈ 200 % zoom) and 320 px. **Stack:** React 19, TypeScript, Tailwind 3 with CSS-variable
tokens (`src/index.css`), Leaflet, vis-network. **Project docs found:** none for the interface (the old
`DESIGN.md` described a different product and was removed).

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Every control's accessible name (scripted), focus ring on 22 tab stops, drawer focus handling, map/graph keyboard paths, reduced motion | 6 found, all fixed |
| Layout | Horizontal overflow on all 8 pages at 320 px and 640 px, sticky header scroll padding, map card height | 3 found, all fixed |
| Writing | All UI strings: buttons, errors, empty states, headline claims | 1 found, fixed |
| Typography | Type scale, line-height by role, tabular numbers, input size (16 px), wrapping | Clear |
| Colors | Token use, rendered contrast of every text/background pair in both themes, risk colours paired with labels | 2 found, all fixed |
| UI polish | Transition properties, press scale, hover under `(hover: hover)`, theme-switch suppression, overscroll containment | 1 found, fixed |

## Findings (all fixed)

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `Shell.tsx`, Present button | Icon + `hidden sm:inline` text: no name below 640 px | `aria-label="Presentation mode"` with `aria-pressed` | Icon-only control with no accessible name |
| HIGH | Accessibility | `WardMap.tsx` / `MapPage.tsx` | Wards selectable only by clicking polygons | Added a labelled ward `<select>` beside the map | Pointer-only path |
| HIGH | Accessibility | `GraphView.tsx` / `GraphPage.tsx` | Node details only by clicking canvas nodes | Added an "Inspect a node" `<select>` | Pointer-only path |
| HIGH | Accessibility | `Shell.tsx`, mobile drawer | `aria-modal` dialog with no focus move, trap or restore | Focus moves to the current page link, Tab is trapped, Esc closes, focus returns to the menu button | Keyboard users lost behind the overlay |
| HIGH | Accessibility | `index.css` `.btn:active`, `AskPage.tsx` scroll, Leaflet zoom | Scale, smooth scroll and zoom animations ran under reduced motion | Gated behind `prefers-reduced-motion: no-preference`; Leaflet `zoomAnimation` off when reduced | Motion ignoring user preference |
| HIGH | Layout | `WardsPage.tsx` table | HVI column pushed past the table's scroll edge at 320 px | Secondary columns `hidden md:table-cell`, HVI bar hidden on phones; score and category always visible | Content past a scroll edge with no cue |
| HIGH | Layout | `AskPage.tsx` `RowsTable` | `truncate` + `title` (not keyboard reachable) | Cells wrap (`break-words`, max 40ch) | Truncated value with no way back |
| MEDIUM | Colors | `AskPage.tsx` question input | `border-transparent bg-sunken` on a surface card (≈1.1:1 boundary) | Standard `.input` with `line-strong` border (3.3:1) | Input boundary below 3:1 |
| MEDIUM | Colors | `WardMap.tsx`, `GraphView.tsx` | Hex literals for facility and node colours, same in both themes | `--cat-*` tokens with dark-mode values | Literals where tokens should be used; poor dark contrast |
| MEDIUM | Layout | `Overview.tsx` top-wards list | Three score bars overlapped at 320 px ("0.72People") | One column below 420 px | Overlap at narrow width |
| MEDIUM | Layout | `MapPage.tsx` map card | Card stretched to the side column height, legend floating in empty space | `h-fit self-start` | Misleading empty area |
| MEDIUM | Writing | `Overview.tsx` hero | "…the fewest hospitals per person" (true for M/East only) | "hot surfaces meet crowded slums and little help nearby" | Claim not supported by the data |
| LOW | UI polish | `WardMap.tsx` tooltips | Middle-dot separators | Comma and parentheses | Consistent punctuation |

## Verification

**Passed (scripted with Playwright, `/tmp/verify.py` during the review):**
- Tabbed through 22 stops on Overview: every focused element showed a ≥ 2 px outline.
- Unnamed visible controls: 0 on every page, desktop and 320 px.
- Horizontal overflow: 0 px on all 8 pages at 320 px, and on Overview, Ward rankings and Ask at 640 px / DPR 2.
- Mobile drawer: focus moves inside on open, stays inside after 12 Tabs, and Esc returns focus to "Open navigation".
- Reduced motion: hero entrance switches from rise+blur to a fade.
- Contrast (computed from tokens): ink 16.5:1, muted 6.1:1, accent 6.1:1 on surface (light); 14.0:1, 6.8:1, 8.2:1 (dark). Risk fills ≥ 3.4:1 against the surface; risk is always paired with its word.
- Screenshots reviewed for every page in light and dark mode.

**Not verified:** screen-reader output (no NVDA/VoiceOver available in the build environment) and RTL
mirroring (the app is English-only; logical properties are used throughout).

## Verdict

**Approve.** No HIGH findings remain. Not reviewed: screen-reader announcement order, which should be
spot-checked with NVDA before the presentation.
