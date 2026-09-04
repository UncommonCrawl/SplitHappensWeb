# Split Happens iOS UI Reference

Status: authoritative implementation reference for the browser client  
Source snapshot: iOS repository commit `3d27abcf41b2363dacaf18bcba987a7665cad397`  
Primary source: `SplitHappens/ContentView.swift`  
Supporting sources: `SplitHappens/CriteriaRuleSet.swift`, `SplitHappens/Assets.xcassets`, `SplitHappens/Sounds`

## 1. Purpose and authority

This document specifies what the current iOS app actually renders and how its visible states behave. It is intended to prevent the browser client from approximating tile colors, shapes, criteria seals, interaction feedback, or modal presentation differently from iOS.

When references disagree, use this precedence:

1. Current SwiftUI behavior at the source snapshot above.
2. Exact constants and state precedence documented here.
3. Supplied desktop prototype for desktop-only composition.
4. General visual judgment.

The browser may rearrange regions responsively, but the visual meaning of a state must remain the same. For example, a valid completed row must use the iOS green tile fill even if the desktop grid is wider.

## 2. Platform envelope

- iPhone supports portrait only.
- iPad supports portrait, portrait upside-down, and both landscape orientations.
- The app targets device families iPhone and iPad.
- The UI uses SwiftUI system typography and SF Symbols. It does not declare a custom font.
- The content canvas is explicitly white with black text, so the game surface is effectively a light appearance even if the device uses Dark Mode.
- Safe-area insets are honored in all layout calculations.

## 3. Canonical design tokens

### 3.1 Colors

These are literal values from `AppColor`. Do not sample them from screenshots.

| Token | RGB | Hex / alpha | Use |
|---|---:|---:|---|
| `boardBackground` | 255, 255, 255 | `#FFFFFF` | App and sheet background |
| `tileFill` | 248, 238, 210 | `#F8EED2` | Neutral letter tile |
| `tilePlaceholder` | 222, 222, 222 | `#DEDEDE` | Empty target slot; pre-reveal tiles |
| `tileCorrect` | 222, 241, 211 | `#DEF1D3` | Every tile in a completed valid row |
| `tileIncorrect` | 251, 226, 224 | `#FBE2E0` | Every tile in a completed invalid row |
| `letterCorrect` | 0, 176, 80 | `#00B050` | Gold-word progress letters |
| `criteriaBronze` | 175, 145, 110 | `#AF916E` | Bronze seal and bronze level tile |
| `criteriaSilver` | 209, 209, 209 | `#D1D1D1` | Silver seal and silver level tile |
| `criteriaGold` | 255, 216, 107 | `#FFD86B` | Header, gold seal, gold slots, gold level tile |
| `goldDark` / `darkGold` | 247, 185, 0 | `#F7B900` | Gold text/accent in victory content |
| `tileInnerShadow` | 68, 51, 30 at 10% | `rgba(68,51,30,.10)` | Standard inset tile shadow |
| `noBadge` | 224, 224, 224 | `#E0E0E0` | Defined fallback token |
| `buttonActive` | 96, 96, 96 | `#606060` | Navigation and action icons |
| `textDefault` | 0, 0, 0 | `#000000` | Primary text |
| `selection` | 0, 0, 0 at 30% | `rgba(0,0,0,.30)` | Selected and drop-target outlines |
| `opaqueText` | 0, 0, 0 at 30% | `rgba(0,0,0,.30)` | Defined subdued-text token |

Browser token translation:

```css
:root {
  --sh-bg: #fff;
  --sh-tile-neutral: #f8eed2;
  --sh-slot-empty: #dedede;
  --sh-row-valid: #def1d3;
  --sh-row-invalid: #fbe2e0;
  --sh-letter-correct: #00b050;
  --sh-bronze: #af916e;
  --sh-silver: #d1d1d1;
  --sh-gold: #ffd86b;
  --sh-gold-dark: #f7b900;
  --sh-control: #606060;
  --sh-text: #000;
  --sh-selection: rgb(0 0 0 / 30%);
  --sh-inner-shadow: rgb(68 51 30 / 10%);
}
```

### 3.2 Typography

Use the platform system sans-serif. On Apple platforms this resolves to San Francisco. For the browser:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
  "Segoe UI", sans-serif;
```

Important weights and sizes:

| Element | iOS specification |
|---|---|
| Tile letter | `max(16pt, tileSize × 0.60)`, bold |
| Criteria label | `clamp(11pt, tabHeight × 0.12, 22pt)`, bold, centered, up to 4 lines |
| Game date subtitle | criteria label size, semibold |
| Level-grid month | derived criteria size, semibold |
| Level-grid day | `max(18pt, tileSize × 0.24) × 1.10`, bold |
| Featured month | derived criteria size, bold |
| Featured day | `max(18pt, tileSize × 0.24)`, bold |
| Popup title | popup grid tile size × 0.40, heavy |
| Popup body | popup grid tile size × 0.20 unless overridden |
| Popup secondary action title | 30pt heavy |
| Standard popup action | 24pt bold |
| Level note title/body | 32pt heavy / 20pt regular italic |

Do not substitute the heavy popup titles with ordinary `font-weight: 700`; use approximately 800–900 where the browser font supports it.

### 3.3 Shapes and surfaces

All game and level tiles are rounded rectangles. Source and target corner radius is exactly 10% of tile size:

```swift
cornerRadius = tileSize * 0.1
```

```css
.tile { border-radius: 10%; }
```

The standard surface is a solid fill with an inset shadow at `x: 0`, `y: -1`, blur radius `1`, color `rgba(68,51,30,.10)`.

```css
.tile {
  background: var(--tile-fill);
  box-shadow: inset 0 1px 1px rgb(68 51 30 / 10%);
}
```

CSS inset-shadow signs do not map directly to SwiftUI's inner-shadow coordinate system. Verify visually; the intended result is a subtle darker inner edge toward the top for filled/raised tiles. Empty/recessed states pass `shadowYOffset: +1`, visually reversing the inset direction.

There is no normal outer drop shadow on stationary tiles. Outer shadow appears only on the lifted drag ghost and correctly placed gold tiles.

## 4. Screen and presentation model

The root contains two horizontally sliding panes under one shared header:

```text
levels pane  <----  viewport  ---->  game pane
                         shared header above both
```

- Launch restores either the level-selection pane or last game pane.
- Level entry and exit use `.easeInOut(duration: 0.5)` and slide by one full viewport width.
- The game pane is prepared before the slide with animations disabled.
- Tile colors and letters reveal with `.easeIn(duration: 0.22)` once the game pane is shown.
- Sheets are native bottom sheets with the drag indicator hidden and a white presentation background.
- Most sheet heights are measured from content, clamped to at least 200pt and at most 92% of screen height. Settings is initially 600pt; About is initially 500pt; other sheets default to 420pt until measured.

## 5. Shared header

### 5.1 Geometry

- Full-width background: `criteriaGold` (`#FFD86B`).
- Fixed title-bar height: 44pt, plus top safe area.
- Horizontal title-bar padding: 20pt.
- Side control columns: 44pt each.
- Center wordmark height: `28 × 1.8 = 50.4pt`, aspect-fit.
- Header content width is capped at 460pt even on wider iPad layouts.
- On a game screen, add a subtitle row whose height is `max(30pt, subtitleFontSize + 16pt)`.
- Below the subtitle, add a buffer of `subtitleFontSize × 0.3`. On the level screen, the buffer equals `subtitleFontSize`.

### 5.2 Controls

Level-selection header:

- Left: `gearshape`, size `34 × 0.8 = 27.2pt`, `#606060`; opens Settings.
- Center: `Title` asset, aspect-fit.
- Right: `chart.bar`, 27.2pt, `#606060`; opens Stats.

Game header:

- Left: `arrow.backward`, 27.2pt, `#606060`; exits the level.
- Center: `Title` asset.
- Right: `arrow.trianglehead.counterclockwise`, 27.2pt, `#606060`; recalls all tiles and clears hints for the current level.
- Subtitle: `Weekday, Month Nth`, semibold black. Example: `Monday, August 24th`.
- If a level has a note, append `info.circle` at the subtitle's font size and make it a button opening Level Info.

The web header may move these controls for desktop composition, but icon identity, semantic action, and active color should remain consistent.

## 6. Level-selection screen

The current iOS app opens to a level selector, not directly to today's puzzle.

- Only released scheduled levels are visible.
- Today's level is featured. If no level exists for today, the newest released level is featured.
- Remaining released levels are newest-first.
- Content width is capped at 460pt with 24pt outer horizontal padding.
- An additional 5% safe zone is removed from each side of the capped stack.
- Grid has 3 equal columns.
- Inter-tile spacing is `max(target horizontal spacing × 2, 16)`, therefore 16pt with current constants.
- Regular tile size is `floor((stackWidth - 2 × spacing) / 3)`, minimum 56pt.
- Featured tile is a square spanning the full tile stack width.
- The featured tile currently reuses the regular grid tile's corner radius rather than 10% of its own size. This is an implementation detail to match if pixel parity is required.

Tile fill reflects the highest permanently achieved criterion:

```text
Gold achieved   -> #FFD86B
Silver achieved -> #D1D1D1
Bronze achieved -> #AF916E
No criterion    -> #F8EED2
```

Each level tile contains a white, filled `seal` SF Symbol at 90% of tile width/height and 60% opacity behind the date label.

- Featured label: full uppercase month over day.
- Grid label: 3-letter uppercase month over day.
- Earned special badges appear near `y = 82%` as palette-rendered symbols. Primary palette is cream `#F8EED2`; secondary palette is control gray `#606060`.

## 7. Game-screen composition

Vertical order:

```text
shared gold header and date
criteria seals / labels (3 equal columns)
flexible space
target rows
up to 20pt flexible gap
source rows
up to 20pt flexible gap
bottom actions
```

### 7.1 Width and responsiveness

- Outer horizontal padding: 24pt.
- Compact content width cap: 460pt.
- Expanded mode begins at 700pt available width.
- Expanded content width cap: 620pt.
- Minimum calculated usable width: 220pt.
- Source spacing: 5pt horizontal, 10pt vertical.
- Target spacing: 4pt horizontal, 12pt between rows including the separator region.
- Target row separator: 1pt black at 20% opacity, full target-board width.
- Minimum source tile: 24pt.
- Minimum target tile: 32pt.

The layout solver sizes both boards against the maximum row/column shape across the active level corpus, not only the current level. Short rows use transparent cells so all rows align to the common grid.

Height budgeting uses:

| Section | Minimum | Share of extra height |
|---|---:|---:|
| Source | 96pt | 24% |
| Target | 220pt | 48% |
| Criteria | 140pt | 28% |

The solver caps the criteria height to the width of one of its three equal columns and redistributes excess criteria height to source/target using the 24:48 ratio.

Reference TypeScript translation:

```ts
const sourceHeightFit =
  (sourceSectionHeight - (sourceRows - 1) * 10) / sourceRows;
const targetSeparatorHeight = 12; // 1px rule + 5.5px padding each side
const targetHeightFit =
  (targetSectionHeight - (targetRows - 1) * targetSeparatorHeight) / targetRows;

const boardWidth = (size: number, columns: number, gap: number) =>
  size * columns + gap * (columns - 1);
```

`sourceTileBaseSize`, `targetTileBaseSize`, and their expanded variants exist in Swift but are not currently used by `BoardLayout`. Do not treat those four constants as rendered sizes.

## 8. Tile anatomy and state matrix

### 8.1 Universal anatomy

- Uppercase black character.
- Bold system font at 60% of tile size, never below 16pt.
- Rounded rectangle, radius 10%.
- Neutral stationary tile has cream fill and subtle inset shadow.
- Selection is a 3pt rounded outline using 30% black.
- Drop hover is the same 3pt outline.

### 8.2 Source tile states

| State | Fill | Letter | Inset direction | Outline |
|---|---|---|---|---|
| Before reveal | `#DEDEDE` | hidden | recessed (`+1`) | none |
| Available | `#F8EED2` | black, 100% | raised (`-1`) | optional selection |
| Selected | `#F8EED2` | black | raised | 3pt `rgba(0,0,0,.30)` |
| Being dragged | original content opacity 0 | hidden | origin shows cream at 20% opacity, recessed | none |
| Empty after moving letter | cream at 20% opacity | none | recessed (`+1`) | optional drop hover |
| Source drop hover | state fill | state letter | state direction | 3pt selection color |
| Structural padding cell | transparent | none | none | none |

An empty source slot is not gray after reveal. It is `tileFill.opacity(0.2)`, approximately `rgba(248,238,210,.20)` over white.

### 8.3 Target fill priority

The order below is exact. Earlier cases override later cases:

```ts
function targetAppearance(s: TargetVisualState): TargetAppearance {
  if (!s.revealed) return { fill: "#DEDEDE", insetY: +1 };
  if (s.correctGold) return { fill: "correct-gold-gradient", insetY: -1 };
  if (s.draggingOrigin) return {
    fill: s.isGoldSlot ? "#FFD86B" : "#DEDEDE",
    insetY: s.isGoldSlot ? -1 : +1,
  };
  if (s.isGoldSlot) return { fill: "#FFD86B", insetY: -1 };
  if (s.rowComplete) return {
    fill: s.rowValid ? "#DEF1D3" : "#FBE2E0",
    insetY: -1,
  };
  if (s.hasLetter) return { fill: "#F8EED2", insetY: -1 };
  return { fill: "#DEDEDE", insetY: +1 };
}
```

Consequences:

- Gold slots remain gold even when their completed row is valid or invalid.
- A correctly placed gold tile gets the special gradient even if its row is incomplete.
- A non-gold tile in a completed row becomes green or pink as a row, not individually.
- Incomplete occupied targets remain cream.
- Empty targets remain gray.

### 8.4 Correct gold rendering

A correctly placed gold tile uses all of the following:

```css
.tile--correct-gold {
  background: radial-gradient(
    circle at center,
    rgb(255 216 107 / 10%) 0,
    #ffd86b 90%
  );
  border: 1px solid rgb(255 216 107 / 70%);
  box-shadow:
    inset 0 1px 3px rgb(255 255 255 / 100%),
    0 0 4px rgb(255 216 107 / 30%);
}
```

The Swift gradient starts at radius 1 and ends at `tileSize × 0.9`. The surface uses a white inner shadow at full opacity and radius 3; the letter layer uses a white inner shadow at 50% opacity and radius 3. Avoid a flat yellow fill for this state.

### 8.5 Hint-locked rows

- A hint fills one answer row at a time from top to bottom.
- Every slot and letter in a hinted row becomes non-interactive.
- The placed letter-tile layer is rendered at 50% opacity.
- The underlying slot surface remains at its normal state color.
- Hint completion resets undo history, so undo cannot remove the hint.

### 8.6 Selection and swapping

- Tap a source/target letter to select it; selected letter gets a 3pt outline.
- Tap an empty target to select the slot; selected empty slot gets the same outline.
- Tap the same selection again to clear it.
- With a letter selected, tap a target to place/swap into that slot.
- With an empty target selected, tap a letter to place it there.
- With a target slot selected, tapping another occupied target moves its letter to the selected slot.
- Tapping outside source/target hit regions clears the selection.
- Double-tap a source letter within 300ms to place it in the first open, unlocked target slot.
- Double-tap a target letter within 300ms to return it to the first available source slot.

## 9. Drag behavior and feedback

Drag begins after either:

- movement exceeds 3pt, or
- normalized touch force reaches 0.18.

During drag:

- Origin letter disappears.
- A faint under-finger tile is rendered at 22% opacity.
- A lifted ghost is offset `-38pt` vertically, scale `1.08`, opacity 92%.
- Lifted ghost outer shadow: selection black at 24%, radius 8, offset `(0, 4)`.
- Pickup animates from scale `0.88` to `1.0` with spring response `0.18`, damping `0.62`.
- When previewing a target, the under-finger tile disappears and lifted ghost opacity becomes 55%.
- Target hitboxes expand by 22pt in all directions.
- Source hitboxes expand by 20pt.
- Nearest candidate wins if expanded hitboxes overlap.
- Drop hover uses the same 3pt selection outline.

A fast downward flick returns a placed tile to source when all conditions are met:

- vertical speed greater than 900pt/s,
- vertical speed greater than horizontal speed × 1.15,
- predicted vertical speed at least actual vertical speed × 1.08.

Feedback:

- Pickup: light impact haptic, intensity 0.3.
- Crossing to a new target: selection haptic.
- Committed drop: medium impact haptic.
- Placement sound: `tile-place.wav`.
- Milestone sheet appearance: `victory.mp3`.
- Sound and haptics are independently toggleable.

For browsers, use hover/focus/animation for universal feedback. `navigator.vibrate()` is an optional enhancement and must not be required for state comprehension.

## 10. Criteria seals

There are always exactly three equal-width criteria columns in Bronze, Silver, Gold order.

- Columns have zero inter-column gap.
- Seal size: `clamp(28pt, tabHeight × 0.5, 34pt)`.
- Top padding: `max(6pt, tabHeight × 0.05)`.
- Gap between seal and label: `max(4pt, tabHeight × 0.05)`.
- Label is centered, bold, and limited to four lines.
- Each criterion is gated by all preceding criteria.
- Achievements latch permanently once earned, even if later tile moves stop satisfying the live rule.

Unachieved seal:

- SF Symbol `seal.fill`.
- Fill is Bronze/Silver/Gold.
- Inner shadow uses standard shadow color at 50%, radius 1.
- `y = -1` when its live condition is met, otherwise `+1`.
- When the live condition is met, overlay the outline SF Symbol `seal` in 30% black.

Achieved seal:

- SF Symbol `checkmark.seal.fill`.
- Palette layers: black check/outline over Bronze/Silver/Gold fill.
- Overlay `seal` in black at scale 1.02.
- Bronze and Silver transitions use spring response 0.26, damping 0.74; overlay uses 0.2s ease-out.
- Gold deliberately does not use the seal achievement spring (`enableAchievementAnimation` is false for index 2), though the surrounding criteria-state update is spring-animated.

Implementation note: `sealBorderOpacity` is calculated from prior-criterion state but is not consumed inside `criteriaRow`. Actual iOS output therefore uses full opacity whenever the live condition requests an outline. Match visible behavior, not the unused parameter.

Gold criterion label:

- Static text is black.
- Each letter of the gold word is `#00B050` at full opacity when correct and 50% opacity when incorrect.
- The entire label is a button. Activating it auto-places gold letters in the correct slots when possible.

Common generated labels include:

```text
N/N VALID WORDS
ONE WORD IS 'WORD'
ANY ROW HAS DOUBLE 'L'
2 ROWS END IN 'S'
ROW 3 STARTS WITH 'A'
NO ROW CONTAINS 'ING'
GOLD TILES SPELL WORD IN ORDER
```

## 11. Bottom game actions

The bottom action bar is an equal-width horizontal row with zero spacing and width `sharedStackWidth - 20pt`.

1. `questionmark.circle`, 42pt, opens How To Play.
2. `lightbulb.circle.fill`, 50.4pt (`42 × 1.2`), applies the next sequential hint.
3. `arrow.uturn.backward.circle`, 42pt, undoes the latest move.

Enabled icons use `#606060`. Disabled undo uses `#D1D1D1`. Disabled actions render as non-buttons.

The current shipped bottom bar has no shuffle button. The top-right game control is Recall All, not Shuffle: it restores original source positions and clears hinted rows.

The device shake gesture also invokes Undo.

## 12. Sheets and modal content

All custom sheets:

- white background extending through safe areas,
- no visible drag indicator,
- top-right close `xmark`, 22pt bold black,
- close hit region is 88 × 88pt containing a 44 × 44pt icon frame,
- content horizontally centered.

Popup sizing derives from a virtual 3-column level grid:

```ts
const safeWidth = Math.max(containerWidth - 48, 220);
const stackWidth = Math.min(safeWidth, 460);
const tileStackWidth = Math.max(120, stackWidth - stackWidth * 0.10);
const tileSpacing = 16;
const popupGridTileSize = Math.max(56,
  Math.floor((tileStackWidth - tileSpacing * 2) / 3));
const popupInset = popupGridTileSize * 0.4;
const titleSize = popupGridTileSize * 0.4;
const bodySize = popupGridTileSize * 0.2;
```

### 12.1 How To Play

Title: `How To Play`.

Body, in order:

1. `Rearrange every letter to form a valid English word in each row.`
2. `Bronze badges are earned when all rows are filled.`
3. `Silver and Gold badges can only be achieved once the previous criteria have been met.`
4. `Use the Hint button to fill in a word from the official answer key. (Each puzzle may have multiple correct solutions!)`
5. `Good luck!`

Action: `Got It`, 30pt heavy.

Highlighted inline terms retain body size but become semibold; Bronze/Silver/Gold use their corresponding accent colors (`Silver` uses `#606060` for text legibility).

### 12.2 Settings

Title: `Settings`. Initial detent 600pt.

Actions, vertically spaced 20pt:

- How To Play
- About
- Sound: ON/OFF
- Haptics: ON/OFF
- envelope icon at 50pt, then `Got Feedback?` at 24pt bold

Off-state Sound/Haptics text uses `#606060`; on-state uses black. Feedback opens `mailto:uncommoncrawl@gmail.com`.

### 12.3 Level Info

- 20pt clear top spacer.
- `Level Info`, 32pt heavy.
- Note body, 20pt regular italic, black at 95%, centered.
- 22pt horizontal padding.

### 12.4 Stats

- Donut chart height 170pt.
- Inner radius ratio 0.62, angular inset 1.6, slice corner radius 4.
- Slice order: Gold, Silver, Bronze, N/A.
- N/A slice uses neutral cream, not gray.
- Legend labels and counts: 30pt heavy; percentages: 24pt semibold at 75% black.
- Legend row width: 350pt.
- `Reset Progress`: 24pt bold, with 80pt top padding.
- Confirmation is a native alert titled `Reset All Progress?` with Cancel and destructive Reset actions.

### 12.5 Milestone sheets

| Milestone | Title | Accent | Secondary action |
|---|---|---|---|
| Bronze | `You Split It!` | `#AF916E` | `Go for Gold`, trophy icon |
| Silver | `Split-acular!` | `#606060` | `Go for Gold`, trophy icon |
| Gold | `Perfect Split!` | `#F7B900` | `Level Select`, grid icon |

- Top image is the `BananaBlack` asset rendered as a template, 144 × 96pt, tinted by milestone accent.
- Body: `You just earned the {Badge} badge for {date}.`
- Buttons: Share (`square.and.arrow.up`) and the milestone-specific secondary action.
- Button icons are 45pt semibold; labels are 20pt bold.
- Gold may show special-badge cards with gray `#DEDEDE` backgrounds and 12pt radius.

## 13. Assets

| Logical name | iOS asset | Pixel dimensions | Rendering |
|---|---|---:|---|
| Wordmark | `Title` / `Title.png` | 3000 × 486 | Original colors, aspect-fit |
| Milestone banana | `BananaBlack` / `BananaBlack.png` | 894 × 559 | Template/tinted |
| App icon | `SplitHappensIcon.png` | 1024 × 1024 | App icon only |
| Placement sound | `Sounds/TilePlace.wav` | n/a | Each committed placement/drop |
| Victory sound | `Sounds/Victory.mp3` | n/a | Milestone presentation |

Web filenames may be lowercase, but do not substitute the desktop prototype logo for the canonical `Title` asset without an explicit design decision.

## 14. Browser implementation contract

Keep rule state separate from visual state. A recommended projection is:

```ts
export type TargetVisualState = {
  revealed: boolean;
  hasLetter: boolean;
  rowComplete: boolean;
  rowValid: boolean;
  isGoldSlot: boolean;
  correctGold: boolean;
  draggingOrigin: boolean;
  selected: boolean;
  dropHover: boolean;
  hintLocked: boolean;
};

export type TileVisual = {
  fill: "placeholder" | "neutral" | "valid" | "invalid" | "gold" | "correctGold";
  inset: "raised" | "recessed";
  outline: "none" | "selected" | "correctGold";
  contentOpacity: number;
  glow: boolean;
};
```

React components should receive the projected visual state and never infer game correctness from DOM position or CSS classes.

Suggested stable class vocabulary:

```text
.tile--source
.tile--target
.tile--empty
.tile--occupied
.tile--row-valid
.tile--row-invalid
.tile--gold
.tile--correct-gold
.tile--selected
.tile--drop-hover
.tile--hint-locked
.tile--drag-origin
.tile--drag-ghost
```

Keyboard focus must be visually distinguishable from game selection. Preserve the 3pt selection outline for game state and add an external focus ring, for example:

```css
.tile:focus-visible {
  outline: 2px solid #000;
  outline-offset: 3px;
}
```

Reduced motion should remove slide/lift movement while preserving immediate state changes and outlines.

## 15. Parity acceptance checklist

### Tiles

- [ ] Neutral source/target letters are cream `#F8EED2`.
- [ ] Empty targets are gray `#DEDEDE`.
- [ ] Vacated source slots are translucent cream, not gray.
- [ ] Completed valid rows are green `#DEF1D3`.
- [ ] Completed invalid rows are pink `#FBE2E0`.
- [ ] Gold overrides row-valid/invalid fill.
- [ ] Correct gold uses gradient, outline, white inset highlight, and glow.
- [ ] Corner radius is 10% of tile size.
- [ ] Selection and drop hover are 3px/pt at 30% black.
- [ ] Hint-locked letter layer is 50% opacity and cannot move.

### Criteria

- [ ] Three equal columns remain Bronze, Silver, Gold.
- [ ] Unachieved seal is filled; achieved seal has black check/outline.
- [ ] Live condition outline and permanent achieved check are distinct states.
- [ ] Gold word uses green letters at 50%/100% opacity by correctness.
- [ ] Clicking/tapping the gold label invokes gold-letter placement.

### Interaction

- [ ] Tap selection and slot selection both work.
- [ ] Double-tap source auto-places; double-tap target returns.
- [ ] Drag origin disappears and lifted ghost renders 38px/pt above pointer.
- [ ] Drop targets receive the 3px/pt hover outline.
- [ ] Hinted rows cannot be selected, swapped, dragged, or undone.
- [ ] Disabled undo uses silver gray.

### Header and sheets

- [ ] iOS-equivalent controls use the documented SF Symbol or a visually faithful icon.
- [ ] Header gold is `#FFD86B`, not a sampled yellow.
- [ ] Wordmark uses the canonical asset.
- [ ] Sheet copy and milestone titles match exactly.
- [ ] Bronze/Silver/Gold accents use the correct distinct tokens.

## 16. Source map for future audits

Use these declarations/functions when the iOS app changes:

| Concern | Swift source |
|---|---|
| Global spacing and tile constants | `BoardUI` |
| Global colors | `AppColor` |
| Responsive solver | `BoardLayout.init` |
| Root pane transitions | `rootGeometryView`, `enterLevel`, `exitLevel` |
| Header | `sharedHeader`, `titleBar` |
| Level selector | `levelsLandingView`, `levelTileButton` |
| Source state | `sourceCell` |
| Target state priority | `targetSlotView` |
| Criteria layout | `criteriaSection`, `criteriaRow` |
| Criteria wording | `LevelCriterion`, `CriteriaRuleSet` |
| Drag visuals | `gameplayView`, `tileDragGesture` |
| Tap/swaps | `handleTileTap`, `handleTargetSlotTap` |
| Hint locking | `useHint`, `isHintLockedSlot`, `isHintLockedLetter` |
| Tile primitive | `letterTileView`, `tileSurface` |
| Sheets | `PopupSheetScaffold`, `popupSheetContent` |
| Stats | `StatsPopupView` |
| Settings | `SettingsPopupView` |

When updating this document, verify rendered behavior as well as constants. Unused parameters and dormant constants exist in the current Swift file; this reference intentionally describes what reaches the screen.
