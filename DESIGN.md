# DESIGN.md — Word Chain Reaction

Plan, review, tokens and assets for the Bicutan Bible Church game. This file is
the source of truth for the visual layer; `HANDOFF.md` describes the code and the
game rules.

---

## 1. The subject

Bicutan Bible Church runs a fellowship game where each word in a chain pairs with
the next — CROSS, WALK, THROUGH, FAITH, STEP. Letters appear one at a time, and
the last letter stays hidden as `?` until the players guess it. A host runs it
from a laptop; the players watch a projector and shout the word.

**The four tile states are the whole visual vocabulary of the site:**

| State | Look | Where it appears |
|---|---|---|
| empty | 2 px outline in `--ink` / `--rule` | the game, the mark, the empty states |
| revealed | solid `--accent` fill | the game, the hero pattern, the finish art |
| given first word | solid `--gold` fill | the game, the hero pattern, the mark |
| `?` | `--gold-text` outline | the game, the hero pattern, the mark, the empty states |

---

## 2. Plan

### 2.1 Colour

Green is the base in the dark theme and the ink in the light theme. Nothing is
grey-neutral: even the page has a green cast, so the whole site reads as one
material. Gold is reserved and appears in exactly three jobs.

| Name | Value (light) | Value (dark) | Job |
|---|---|---|---|
| Paper | `#F2F6F1` | `#0A2A1E` | the page |
| Tint | `#E4ECE5` | `#12382A` | zebra rows, hover |
| Ink | `#0E3B2A` (forest green, used as the ink on purpose) | `#E8F1EA` | text |
| Muted | `#4C6355` | `#9DB8A8` | secondary text |
| Rule | `#C5D1C7` | `#28523F` | structural rules only |
| Accent | `#17794A` | `#5FCB8E` | buttons, revealed tiles |
| On accent | `#FFFFFF` | `#06190F` | text on an accent fill |
| Gold | `#E5A823` | `#E5A823` | the given word tile |
| Gold text | `#7A5200` | `#F0C25A` | the `?` tile, the winner line |
| Danger | `#A32020` | `#FF8F85` | destructive text |

Plus one extra token the brief does not list but the accessibility floor needs:
`--line`, the colour of input and control borders, kept at 3:1 or better against
the paper (the decorative `--rule` is far too light for that).

The Admin picks **Base** and **Accent**; the rest is derived (see 2.6).

### 2.2 Type

**IBM Plex Sans** only: 400 body, 500 labels and links, 600 headings and buttons,
700 for the numbers that must be read from the back of a room (tiles, scores,
countdown).

| Size | Used for |
|---|---|
| 14 px | secondary notes only (never for anything a user must read) |
| 18 px | body text, buttons, inputs, table cells; 18 px on phones too |
| 22 px | screen headings, list titles, section headings |
| 28 px | page headings |
| 35 / 44 px | the login h1, the finish screen, the stage slide titles |

- Body line height 1.5; headings 1.15 to 1.25.
- Line length at most 70 characters (`max-width: 70ch` on the instructions and
  other prose).
- `font-variant-numeric: tabular-nums` on the score and the countdown so the
  numbers do not jump while they change.
- Sentence case everywhere. Tile letters are uppercase because they are game
  content, not because of a style.

### 2.3 Layout

- **Login** — the tile pattern stands beside the form; on phones it becomes a
  short strip above the form.
- **Library** — a list, one row per game, under a cropped strip of the same
  pattern. Column headings in sentence case.
- **Studio** — one column: settings, sample round, generator, rounds.
- **Admin** — a semantic table, pending accounts first.
- **Info** — a `<dialog>` with the creator, the date created and a table of
  matches.
- **Stage** — the chain centred, the scoreboard in a fixed bottom bar, the host
  controls in a quiet strip under it.
- **Present** — the same chain on a second screen, with no navigation and no
  operator controls.

**Alignment rule:** flush left on a grid, always. The only centred things are the
game chain, the stage scoreboard and the stage slide titles.

### 2.4 The welcome message

A game can carry a welcome message: **Series, Title, Sub-title, Date** and a
**Welcome phrase**, written in the Studio. It appears in two places:

- a **block** on the instructions slide, so the audience is welcomed while the
  host sets the teams up;
- a **curtain** on the stage in front of the first round (or the sample round),
  which the host takes down with **Begin** when they are ready. Until then no
  letter is revealed, so the operator controls the pace and the audience reads
  the welcome on the second screen first.

The welcome phrase is set in gold, the one place gold is allowed to be text
besides the `?` tile.

### 2.5 Principles — what makes this site unlike any other

**The letter tile is the one memorable element.** It is the church mark, the
favicon, the hero pattern, the empty states, the finish screen and the share
image. Everything around it stays quiet: hairlines only where they encode
structure, no cards, no shadows, no gradients, no ornament. The cross in the mark
is made of tiles and ends in the gold `?` of the hidden last letter, so the
identity of the church and the rules of the game are one shape.

---

## 3. Review against the brief's "tells"

What would I have produced for any similar app? These are the parts I changed.

| Tell | What I had | What I changed and why |
|---|---|---|
| Warm cream page near `#F4F1EA` | paper `#E8E8E0`, a warm grey | paper `#F2F6F1`, a cool pale green, with a forest-green ink. The page is now made of the same material as the game. |
| Tracked-out ALL-CAPS eyebrow labels | "Fellowship game show", "Instructions", "Finished" | removed. The heading already says it. |
| Meta joined with middle dots | the stage key hints used ` · ` | rewritten as plain sentences. |
| Arrow appended to a link or button | `->` between the word boxes in the studio | replaced with a short connector rule; the chain reads without an arrow. |
| Hairline rules on everything | rules on most blocks | kept only where they encode structure: table rows, the list/controls boundary, the top bar, the stage bars, section breaks. |
| Icons everywhere | icons on the library row actions | text labels there (Play, Present, Info, Edit, Delete). Icons stay only in the host strip and the password field, where space is tight. |
| A near-black page with one acid-green accent | dark paper `#0A2419` | dark paper `#0A2A1E`, a deep green, and a softer accent. The dark theme is green-on-green, not black-on-neon. |
| Numbered markers | rounds are numbered | kept: rounds are a sequence. Nothing else is numbered. |
| Monospace data labels | none | still none. |
| Centred everything | centred login, centred stage | the login is flush left in two columns; only the chain and the scoreboard are centred. |
| Fade-and-slide-up entrances | a screen fade | kept as a plain 120 ms fade, no slide, no per-section entrance. |

---

## 4. Assets (all drawn in code, SVG only)

| Asset | File | What it is |
|---|---|---|
| Church mark | `assets/mark.svg` + `markSVG()` | a cross made of tiles on a 5 x 5 grid, the bottom tile a gold `?` outline |
| Favicon | `assets/favicon.svg` | the mark, tightened for 16 and 32 px, and re-coloured in `brand()` to follow the brand |
| Touch icon | `assets/apple-touch-icon.png` | the mark, rasterised at 180 x 180 |
| Hero pattern | `tileHero()` | the Round 6 chain (CROSS, WALK, THROUGH, FAITH, STEP) showing all four tile states; 5 rows on the login, a 2-row strip for the Games page |
| Gimme 5 preview | `g5Preview()` | the farm question, five numbered answer bars (BAKA and KALABAW revealed) and the five category names |
| Empty states | `emptyArt(kind)` | `games`, `search`, `pending`, `rounds` |
| Finish art | `chainArt(word)` | a completed chain, the winner's row in gold |
| Share image | `assets/og-image.svg` + `assets/og-image.png` | the church name, the game name and the hero chain on paper |

Rules: decorative art is `aria-hidden="true"`, meaningful art gets `role="img"`
and a `<title>`. Colours come from CSS variables, so every asset follows the
light/dark theme and the Admin's Base and Accent. No external image requests.
Only `og-image.png` and `apple-touch-icon.png` are raster.

---

## 5. Copy

- One name per action: "Save game" produces "Game saved."
- Errors say what happened and how to fix it, and never apologise.
- Empty states invite one action.
- Church warmth lives in three places only: the instructions slide, the finish
  screen ("Grace abounds.") and the empty states. The hints in the game data stay
  as the owner wrote them; no scripture is invented. The welcome message is a
  fourth, and it is the operator's own words.

---

## 5a. The host control panel

The controls at the bottom of the stage are in three labelled groups, so it is
obvious what each button does and the operator can find the right one without
reading every label:

| Group | Buttons |
|---|---|
| Navigation | Previous round, Go to round, Next word, Skip round |
| Tools | Reveal word, Pause, Hint, Sound, Stage theme, Present |
| Finish | Finish game, Exit |

The group labels are the only uppercase text in the interface, and they are
labels, not decoration. The second screen shows none of them: the audience gets
the chain, the round, the hint, the score and the winner line, plus a quiet
**Exit** link in the corner that closes that window and leaves the host in
control of the game.

---

## 6. Branding Customizer

The Admin sets **Base** and **Accent** plus name, sub-title and logo URL. Stored
as `{ name, sub, logo, base, accent, v: 3 }` in `app_settings.brand`; no SQL
change. Version 2 objects migrate on load (`accent = primary`, `base = stage`).
Above the two pickers there is a row of **palettes**: six pairs of base and
accent that set both colours at once, for an operator who wants a ready-made
look and then wants to fine tune it.
`PAL` and `applyPal` are gone.

The derivation (`themeVars()` and `stageVars()` in `app.js`):

- **Dark theme** — paper is the base; tint, rule, muted, ink and the control
  border are mixed out of it; the accent is lightened until it reaches 4.5:1 on
  the paper; on-accent goes near-black.
- **Light theme** — the ink is a forest green mixed from the base (so the text
  colour follows the brand); the paper is that ink washed almost to white; tint,
  rule, muted and the control border are the ink mixed back towards the paper;
  the accent is darkened until it reaches 4.5:1 on the paper.
- **Gold** is fixed per theme. **Danger** is fixed per theme.
- If the chosen accent had to be lightened or darkened, the picker says
  *"Adjusted for readability"*.
- The favicon is regenerated in `brand()` with the current Base and Accent.

---

## 7. Final tokens and measured contrast

The values below are what the app actually produces for the default brand
(`base #0A2A1E`, `accent #17794A`). They are close to the brief's starting
table; the differences are the price of the contrast floor.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#F0F3F2` | `#0A2A1E` |
| `--tint` | `#E2E7E5` | `#163529` |
| `--ink` | `#0C3324` | `#EBEEED` |
| `--muted` | `#49665B` | `#98A6A1` |
| `--rule` | `#CAD2CF` | `#314C42` |
| `--line` | `#688177` | `#6C7F78` |
| `--accent` | `#167447` | `#65A686` |
| `--on-accent` | `#FFFFFF` | `#0A110D` |
| `--gold` | `#E5A823` | `#E5A823` |
| `--gold-text` | `#7A5200` | `#F0C25A` |
| `--danger` | `#A32020` | `#FF8F85` |

The stage uses the same values with an `s-` prefix, plus `--s-on-gold #0A1A12`
(the dark letter on the gold tile, which is the same in both stage themes).

### Measured contrast

Every pair was measured with the app's own `ratio()` function, in both themes,
for five different brands (default, live, navy, slate, rose). 24 checks per
brand, all passing.

| Pair | Light | Dark |
|---|---|---|
| ink on paper | 12.42 | 13.20 |
| ink on tint | 11.09 | 11.42 |
| muted on paper | 5.64 | 6.09 |
| muted on tint | 5.04 | 5.27 |
| accent on paper | 5.19 | 5.39 |
| accent on tint | 4.64 | 4.67 |
| on-accent on accent (button) | 5.80 | 6.69 |
| gold-text on paper (the `?`) | 6.20 | 9.22 |
| gold-text on tint | 5.53 | 7.98 |
| danger on paper | 6.75 | 6.99 |
| control border on paper (3:1) | 3.77 | 3.63 |
| control border on tint (3:1) | 3.36 | 3.14 |

Text is at least 4.5:1 everywhere; borders, tile outlines and focus rings are at
least 3:1. The dark accent came out as a softer green (`#65A686`) than the
brief's `#5FCB8E`: it is the darkest green that still clears 4.5:1 on both the
paper and the tint, and it is easier on a projector than a neon mint.

---

## 8. Critique: one thing removed from each screen

The brief asks for a pass over the screenshots and one decoration taken off each
screen. Here is what came off, and why.

| Screen | Removed | Why |
|---|---|---|
| Login | the scripture quotation and the eyebrow label | the warmth belongs to the instructions slide, the finish screen and the empty states, and no scripture may be invented. The tile pattern is the hero now. |
| Library | the lede under the heading, and the icons on every row action | the pattern strip and the heading already say what the page is; text labels (Play, Present, Info, Edit, Delete) are quieter and clearer than icons. |
| Info dialog | the "Winners history" heading | the table's own column headers say it. |
| Studio | the arrow between the word boxes | replaced with a short connector rule, so the chain is a line, not a set of arrows. |
| Admin | the trash icon on Delete, and the five colour pickers | the text carries the action, and the branding is now Base and Accent only. |
| Stage | "Created by" under the game title | the audience does not need to know who made the file; the creator is in the Info dialog. |
| Present view | nothing to remove, only to add | the Exit link was added, quiet, in the corner, because a second screen needs a way out. |
