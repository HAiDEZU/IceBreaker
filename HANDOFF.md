# HANDOFF — Bicutan Bible Church · Word Chain Reaction

Hand-off for an AI coding agent (opencode). Read this first, then open `app.js`.
The visual system is written down in `DESIGN.md`.

## 1. What this project is

A single-page "game show" web app used by **Bicutan Bible Church** for fellowship, youth and retreat icebreakers. A host projects the **Word Chain Reaction** game: a chain of compound words (e.g. `SMART -> WATCH -> LIST`) where each word's letters are revealed one by one and the players guess it. The app also has accounts, a game library, a game studio, an admin panel, branding, team scoring and winners history.

- **Frontend:** plain HTML + CSS + vanilla JavaScript. **No framework, no bundler, no build step.**
- **Backend:** **Supabase** (hosted Postgres + auto REST API). All logic is in SQL functions called through RPC.
- **Hosting:** GitHub Pages (static files) + Supabase free tier.
- **Default Admin:** username `haidezu`, password `qwerty5575` (seeded by `setup.sql`; owner should change it).

## 2. Repository layout

```
index.html   Page skeleton. Loads style.css, config.js, art.js, gimme5.js, app.js. Contains <div id="app"> and the SVG icon sprite.
style.css    All styles, grouped by section comments. Colours are CSS variables.
art.js       The SVG generators: markSVG, tileHero, emptyArt, chainArt, g5Preview. No DOM, so node can run it.
gimme5.js    The Gimme 5 game: state, host views, present window, studio form. Defines functions only when it loads.
assets/      mark.svg, favicon.svg, apple-touch-icon.png, og-image.svg, og-image.png
DESIGN.md    The design system: tokens, wireframes, measured contrast, critique notes.
app.js       ALL application logic (~490 lines, dense; every function has a comment above it).
config.js    window.APP_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }  (user edits this).
setup.sql    Run once in Supabase SQL Editor: tables, RLS, RPC functions, seed admin + default game.
README.md    End-user deployment guide.
HANDOFF.md   This file.
```

Run locally: `python3 -m http.server 8000` in the folder, open `http://localhost:8000`. Fill `config.js` with a real Supabase project, otherwise the app runs in "database not connected" mode (guests can still play the default game, nothing is saved).

## 3. Architecture in one minute

- `boot()` -> shows "Loading...", `pull()` downloads games + branding, validates the saved session token with `app_me`, then `render()`.
- **State** lives in globals in `app.js`:
  - `S = { users, games, brand, theme, stageTheme, session }` — in-memory cache. Only `theme`, `stageTheme` and `session` are persisted in `localStorage` key **`bbc2`**. Everything else comes from the database.
  - `view` = `'auth' | 'lib' | 'studio' | 'admin' | 'stage'`; `go(view)` switches.
  - `ST` = studio (game editor) state; `G` = live game (stage) state.
  - Misc UI globals: `regMode`, `flt`, `q`, `err`, `errKind`, `showPw`, `delId`, `infoId`, `loading`, `lastView`, `bt` (brand save debounce timer).
- **Rendering:** `render()` rebuilds `#app.innerHTML` from template strings (`authV`, `libV`, `studioV`, `adminV`) and `renderStage()` for the stage. Buttons use inline `onclick="fn()"` calling **global functions**. Inputs write straight into state via `oninput` (no re-render while typing, so focus is not lost).
- **Security rule:** every dynamic text goes through `esc()` before being put in HTML.
- **Server calls:** `rpc(fn,args)` (POST `/rest/v1/rpc/<fn>`), `sel(path)` (GET public tables), `authed(fn,args)` (adds `p_token`, logs out on `not_authenticated`). Errors are raised in SQL as short codes and mapped to friendly text by `EM`/`emsg`.
- The Supabase URL is normalised to its origin (`new URL(...).origin`) so a pasted `/rest/v1` does not break it.
- **Colours:** the admin sets two brand colours (`base`, `accent`). `themeVars(dark)` and `stageVars(dark)` derive the whole palette from them and write CSS variables; `brand()` applies the app set to `<html>`, `stageBrand()` applies the stage set to `#stage`. The tokens are `--paper --tint --ink --muted --rule --line --accent --on-accent --gold --gold-text --danger` (and the same with an `s-` prefix for the stage).

## 4. Database (see `setup.sql`)

| Table | Purpose |
|---|---|
| `app_users` | `id uuid, username (unique, lower-case), name, role ('Admin'\|'Registered'), active, pending, pw_hash (bcrypt), pw_enc (pgp_sym_encrypt, so Admin can view), created_at` |
| `app_sessions` | `token uuid, user_id, created_at` (valid 30 days) |
| `app_games` | `id text, owner uuid, by_name, data jsonb, created_at, updated_at` |
| `app_settings` | `key text, value jsonb` — row `brand` holds the branding object |
| `app_secrets` | `pw_key` used to encrypt/decrypt `pw_enc` (never exposed) |

**RLS:** anon may only `SELECT` from `app_games` and `app_settings`. All other tables are locked. All writes go through `SECURITY DEFINER` functions that validate the token.

**RPC functions** (all callable by anon; the ones with `p_token` check login/role):
`app_register`, `app_login`, `app_me`, `app_logout`, `app_admin_users`, `app_admin_user_action(approve|toggle|delete|set_password)`, `app_admin_view_password`, `app_save_brand`, `app_save_game`, `app_delete_game`, `app_save_result` (no auth, by design), `app_remove_result`.
Error codes raised: `bad_credentials, pending, disabled, username_taken, invalid_input, not_authenticated, forbidden, not_found`.

**Game JSON (`app_games.data`)**

A game has a `type`: `"chain"` (or missing) or `"gimme5"`. `g5Type(g)` in `gimme5.js` returns it, so a game without a type is a Word Chain game.

Word Chain:
```json
{
  "title": "Grace Chain Reaction", "desc": "...", "interval": 4,
  "series": "Word Chain Reaction", "sub": "A fellowship icebreaker for all ages",
  "date": "21 October 2026", "welcome": "Welcome, Fellowship!",
  "instr": "instructions slide text",
  "sample": ["FAST","FOOD","CHAIN","SAW","BLADE"],      // optional
  "rounds": [{ "words": ["SMART","WATCH","LIST"], "hint": "General Warmup" }],
  "by": "creator name", "owner": "<uuid or null>",       // set by server
  "results": [{ "id": 1760000000000, "winner": "Team 1", "score": 5,
                "scores": [{"name":"Team 1","score":5}], "by": "host name" }]
}
```
`series`, `sub`, `date` and `welcome` are the welcome message. They are optional:
a game without them simply has no welcome. `DEF` in `app.js` and the seeded game
in `setup.sql` must stay in step.

Gimme 5:
```json
{
  "type": "gimme5",
  "title": "Gimme 5 Fellowship Night", "desc": "...",
  "instr": "instructions slide text",
  "defaultTeams": 2,
  "round1": { "members": 3, "advance": 2, "questions": [
    { "text": "Ano-anong hayop ang makikita sa farm?", "english": false,
      "seconds": 60, "answers": ["Baka","Kalabaw","Kabayo","Manok","Baboy"] } ] },
  "round2": { "seconds": 120, "showWordOnPresent": false, "helperSignals": true,
    "categories": { "Tao": [["Guro","Pari","Doktor","Pulis","Magsasaka"]], "...": [["..."]] } },
  "by": "...", "owner": "...", "results": []
}
```
Every question has exactly 5 answers, every Round 2 set exactly 5 words, at least
one question and at least one set. `seconds` is 10 to 600.
`round1.advance` is how many teams go through to Round 2 (1 to 5). Categories are
shown as Tao (Person), Bagay (Things), Hayop (Animals), Lugar (Places), Pagkain
(Food). **Every set is one choice in the Round 2 blind pick**, so the number of
choices is the number of sets. `round1.members` is left in the file for older
games but is not used any more: the turn of the members is not tracked.

Gimme 5 results (the same `results[]` array, one record per game):
```json
{ "id": 1760000000000, "kind": "gimme5", "teams": 4,
  "winner": "Team 2", "score": 5,
  "r1": { "question": "...", "english": false, "winner": "Team 2",
          "correct": 3, "seconds": 41.3,
          "standings": [ { "name": "Team 2", "correct": 3, "seconds": 41.3 } ] },
  "r2": { "team": "Team 2", "guesser": "Ana", "helper": "Ben", "category": "Hayop",
          "guessed": 5, "of": 5, "seconds": 102.4, "limit": 120, "completed": true },
  "by": "host name" }
```
`winner` and `score` keep the same meaning as Word Chain (`winner` = the team that
played Round 2, `score` = words guessed), so the library "Last winner" line and
the Info dialog read the same for both kinds. `g5LastLine()` and `g5InfoRows()`
render them.

The client adds `id` (row id) and `created` (row `created_at`) after loading. `app_save_game` replaces `data` but preserves `by`, `owner`, `results`. `results` is capped (50 server / 30 client).
The client adds `id` (row id) and `created` (row `created_at`) after loading. `app_save_game` replaces `data` but preserves `by`, `owner`, `results`. `results` is capped (50 server / 30 client). The default game in `setup.sql` mirrors `DEF` in `app.js` — **keep them in sync**.

**Brand JSON (`app_settings.brand`, version 3)**
```json
{ "name": "Bicutan Bible Church", "sub": "Word Chain Reaction", "logo": "",
  "base": "#0A2A1E", "accent": "#17794A", "v": 3 }
```
- `base` is the deep tone behind the app and the stage; `accent` is the green that fills buttons and revealed tiles. Everything else is derived (see `DESIGN.md`).
- **Migration:** `migrateBrand()` upgrades the old v2 object on load: `accent = primary`, `base = stage`, unknown fields (`primary`, `stage`, `mint`, `text`) are dropped. No SQL change is needed; `app_save_brand` accepts any JSON object.
- The v2 palette templates and the 5 colour pickers are **gone**. `PAL` and `applyPal` no longer exist.

## 5. Roles and permissions

- **Admin:** everything; edit/delete any game; Account Management; branding. Cannot be disabled or deleted. Admin row has "Change password" (no View button on the Admin row).
- **Registered:** registers on the login page -> status **pending** until Admin approves. Can create games, edit/delete own games, play all.
- **Guest:** nickname only, **local to the browser, never stored in the DB**. Can play and record winners but not create games.
- Game ownership: `owner` uuid (creator or Admin may edit/delete). Default game has no owner (Admin only).

## 6. Screens and the code that drives them

| Screen | Functions |
|---|---|
| Login | `authV, doUser, doGuest, togglePw, sess, logout, toggleMenu, markArt, heroArt` — the church mark, the title, one line of copy and the tile pattern on the left, the user form (segmented **Log in / Register**) on the right, and the **Guest express** path as a separate secondary block *below* the form. There is no top-level tab any more. Login uses *Username* (not email). Enter key submits. |
| Library | `libV, infoModal, delGame, refresh, emptyState, heroArt, g5Preview` — a list (one row per game), not a card grid, under the two game previews (which also act as the type filter). Search, the type filter (All, Word Chain, Gimme 5, Mine) and Refresh sit above the list on one line. Each row has the facts (rounds or questions, seconds, creator, last winner) and the actions **Play** (primary), **Present** (secondary), Info, Edit, Delete. |
| Info (winners history) | `infoModal` — a native `<dialog>` (focus trapped, Esc closes, backdrop click closes) with creator, date created, type and a table of matches. Word Chain: date won, winner, score, hosted by. Gimme 5: date, teams, the Round 1 winner with its count and time, and the Round 2 pair with category, words found and time. |
| Studio | `openStudio, studioV, studioChainV, studio5V, newGame, newGame5, editGame, editGame5, wordEditor, addRounds, saveGame, saveGame5, aiGen, walk` — the nav has one **Studio** entry; the studio then asks what to create and opens the right form. Word Chain: the Welcome message section (Series, Title, Sub-title, Date, Welcome phrase), Settings, Sample round, Generator, Rounds. Gimme 5: Settings, the Round 1 questions (5 answers each) and the Round 2 categories (sets of 5 words, added with the **Add a set** control that takes the category), with inline validation. Word inputs are joined by a short connector rule. There is no switch for the current word on the Present window: it is always shown. |
| Admin | `adminV, delBtn, uact, viewPw, chgPw, loadUsers, accentNote, updPreview, bsave, emptyArt, applyPal` — accounts as a real table (sticky header, pending accounts first with **Approve** as the primary action, a "No accounts are waiting" empty state) and the Branding Customizer: a row of six **palettes** (`PAL`) that set the base and the accent together, then name, sub-title, logo URL, **Base colour**, **Accent colour**, a preview of the four tile states and the church mark, and a "Reset branding" button. Brand saves are debounced (700 ms) via `app_save_brand`. |
| Stage | `play, setR, startWord, tick, reveal, next, prev, skip, skipSample, endGame, finish, saveResult, setWin, resume, fit, fitTiles, stageBody, renderStage, setTeams, sc, setStageTheme, stageBrand, stageTheme, hasWelcome, welcomeBlock, welcomePanel, dismissWelcome` — the control panel at the bottom is in three labelled groups: **Navigation** (Previous round, Go to round, Next word, Skip round), **Tools** (Reveal word, Pause, Hint, Sound, Stage theme, Present) and **Finish** (Finish game, Exit). |
| Second screen | `present, presentLive, openPresent, pushPresent, presentIntro, presentBoot, renderPresent, closePresent` |

## 6a. The two games

**Word Chain Reaction** (`type` missing or `"chain"`) is the original game, unchanged.

**Gimme 5** (`type: "gimme5"`, in `gimme5.js`) is a two round game.

**Round 1 is played one team at a time.**
1. The team **blind-picks a question**: one face-down box per question the host
   wrote (three questions, three boxes), the pick starts on box 1, and the
   question under the chosen box is revealed (and flashes) before the round begins.
   The boxes **stay for the whole round**: a box that has been taken is marked
   *Picked* and cannot be taken again, so the next team takes another number and
   the audience can see which numbers are gone. The Round 1 boxes and the Round 2
   boxes are kept apart, so one can never clear the other. If the questions run
   out, the questions are put back as **free numbers** and the numbers that were
   taken **stay taken**; the page says so.
2. The team's **members work together**: they guess the **5 hidden answers**
   (keys 1 to 5 mark a slot correct). The five slots belong to the team, not to
   one player. The slots **cannot be clicked**: the operator marks an answer from
   the *operator only* list beside them (or with the number keys), so a stray
   click can never reveal an answer on the audience screen before the clock has
   even started. An answer that is found **comes in with a quick movement of the
   text** (a text animation, the background stays still), on the host's screen
   and on the audience screen. The list is there from the first
   second, so the operator can see which answer is which, but it cannot be used
   before the round has started.
   There is no team tag on the answers any more. **The turn of the members is
   not tracked on the screen** (there is no Wrong button and no member number):
   the host calls on the members in real life.
3. **Every team gets the full time.** Picking a question clears the clock, so the
   host presses *Start the round* and the countdown runs from the time the
   question allows (one minute by default) and the team's time is measured from
   that moment. The times can therefore be compared. **The clock stops while it
   is paused** (the paused time does not count) and **the time never goes past
   the time the host set**.
4. When the time runs out the **board stays and the clock stops**. The page says
   *The time is up. Reveal the remaining answers to end the round*. **Reveal
   remaining** is greyed out while the clock is running; the **first press shows
   the answers nobody found** (they turn *not guessed* in the operator list and
   do **not** count for the team) and keeps the round open, the **second press
   (Show the result)** ends the round and shows the result. After the time is up
   the operator can also **reveal one answer by hand** from the operator list: it
   shows on the board, it is marked *not guessed*, it does not count, and it
   never jumps to the result page on its own.
   A revealed answer **shows in its slot** (in gold, so it is clear it was not
   guessed). The result page shows the answers that were not found **under the
   words the team did guess**, in a row marked *Unfound*. The Round 2 result does
   the same with the words that were not found. The result shows the **question**
   (round 1) or the **category** (round 2) above the answers, and keeps it in
   the record.
5. When the team has found all five the game shows the **result of that team**:
   the time it took on the left, the answers it found in **big type on the
   right**, the answers that were not found under them, and then the **Next
   team** button goes back to the blind pick for the next team, who tries to beat
   the other times.
6. After every team has played, the **Round 1 ranking** appears: the times, the
   answers found, and who is through. The number of teams that go through is a
   setting (`round1.advance`, 1 to 5) in the Studio, so three teams can send two
   forward and five teams can send three. The column says **Qualified** (in
   colour) or **Eliminated**. The ranking is also on the audience screen.

**Round 2** is played by the teams that came through, one after the other. The
blind pick page has **only the boxes** (the Guesser and Helper are not picked
there). They blind-pick one of the boxes to get a category (Tao, Bagay, Hayop,
Lugar, Pagkain); there is **one box for every set** the host wrote, so the number
of choices is their choice, and the boxes stay for the round, so each team takes
another one. The 5 words come from the set that was under the box.

The Round 2 board has **three columns and no frames around them** (the cards are
the only thing that carries a line), with the labels **Remaining**, **Guess** and
**Found** centred over their column:
- **Remaining** (left) — how many are left, and the words that are still waiting
  as small cards with the number and a question mark, **in the order they will
  be played**. Clicking a card shows that word, but only when the clock is not
  running.
- **Guess** (middle) — the word that is up, in the largest type on the screen,
  with **its number in the top left corner** so the word can use the whole card.
  The letters are made **smaller when the word is long**, so it never breaks and
  never touches the line (`g5FitWord()`). It is **only there once the round has
  started**: before that the middle holds a face down card, so nobody can read
  the word early.
- **Found** (right) — how many were found, and the words that were found as
  small cards.

The category stands on top of the board in the same size as the name of the
church, on both screens. The middle card is the focus: the two sides are only an
indicator, so the screen does not get crowded. The Guess card has a right size of its own (it does not eat
the whole column) and a line in the accent colour, the word in it is as big as
the card allows and is only a little smaller when the word is long, the waiting
and the found words are small cards with small text, and **the audience screen
uses the same card sizes as the host's screen**. The category is on top of the
board, in the middle, on both screens.

**The setup page** shows only the name of the game (big) and the fields the host
has to fill in. The texts keep the line breaks the host typed in the Studio, on
both the host's screen and the audience screen. On the audience screen the setup page shows the name of the game
and nothing else. **The welcome page** (the curtain before the first round) has
three parts: the name of the game on top, the title of the game and its
description in the middle, and the instructions at the bottom. The title is
bigger than the description. The audience screen shows the same text with the
same spacing.

A card **flies** to the middle when its turn comes and **flies again** to the
right when the Guesser gets it (`g5-fly`, 0.26 s).

The Helper may only say "Oo", "Hindi" or "Pwede" out loud, so the operator has no
signal buttons and no reminder line. Keys: Enter correct, P pass, Space start or
pause. The **pass is rotational**: the word that is up goes to the back of the
queue and the next one comes up, so the words run 1, 2, 3, 4, 5 and then start
again at 1. **Pass is not allowed when one word is left.** The **Correct** button
is greyed out until the round has started, and **Reveal the rest** is greyed out
while the clock is running, so nothing can be revealed by accident. When the time
runs out the board stays and the clock stops, and the page says *The time is up.
Reveal the rest to end the round*. **Reveal the rest** shows the words that were
not guessed, but they do **not** count for the team. The **Correct** button is
greyed out when the clock has run out, so nothing can be counted by accident. When the round ends the
**result of that team** appears (the time and the words found); after the last
team the game ends with the ranking, the winner and the data of the game. The
team with the most words (then the fastest) wins.

**The current word always goes to the audience screen.** There is no switch for
it in the Studio: the players have to see the word the Guesser is after.

**The top bar is the same on both screens, in both rounds.** It is a three-part
bar: the name of the game on the left, the **countdown in the middle**, and the
round on the operator's screen or the **name of the church** on the audience
screen, on the right. The clock keeps its column even when it is not running, so
nothing jumps. The Round 2 clock is part of the same bar (the snapshot carries it
as `clock`, the same key Round 1 uses), so the audience sees the timer in both
rounds. Before the round starts the clock shows **the time the host gave the
round** (not `0:00`), so the players and the audience can see how long they will
have; while the clock is paused it shows the time that is left, and when the time
is up it shows `0:00`. The host sends the number to display as `clock.left` in the
snapshot, so both screens agree at every moment.

**There is no team bar.** The teams, their scores and their times are not shown
under the board; the ranking page has that information.

**The answers are never on the audience screen.** The host's screen shows the full
list of answers in a gold-ruled panel marked *operator only*, next to the slots,
with the team and the member who is up. The audience window only ever receives
the answers that have been found or that the host has deliberately revealed
(`g5RevealRest()`), through the snapshot (`g5Snapshot()`), which is checked in
the tests. The only exception is the Round 2 word in the middle column, and only
when the game allows it (`round2.showWordOnPresent`, on in the demo game) and
the round has started.

**The Gimme 5 Present window** uses its own mechanism: the host opens
`index.html#present=<sessionId>` and broadcasts a snapshot through
`BroadcastChannel('gimme5-'+sessionId)` after every state change, with a
`localStorage` fallback. The window needs no login and makes no database calls:
`boot()` sees the `#present` hash and calls `presentG5Boot()`. The window asks
for the state with a "hello" message, and the host shows *Present window connected
* or *not connected* on the stage. The window has a **Fullscreen** button and an
**Exit** link that closes the audience window and leaves the host in control of
the game. Both sit in the bottom corner in the stage's muted colour at low opacity,
so they are almost part of the background on the projector; the pointer or the
keyboard brings them back.

What the audience window shows, step by step:
- before the first round: the **name of the game, big at the top**, and the
  description and the instructions **at the bottom** (the same text as the *How
  to play* page), with the welcome message in between. The host's welcome screen
  does the same: the name of the game at the top middle, the sub text and the
  welcome phrase at the bottom middle;
- the blind pick: **Pick a number** at the top left, the sub text of the round
  **above the cards**, and the numbered boxes centred under it, with the ones
  that have been taken marked. The cards grow with the screen and the number and
  the word *Picked* grow with the card. The cards sit in a **pyramid**: the top
  row takes the most, the rows below take the rest, so five cards are three on
  top and two below (never four and one). A card keeps its own number, its place
  in the whole list and not in its row, so the pick still lands on the right
  question. The Round 2 pick is the same. On a short screen the cards are made
  **shorter, never narrower**, so two rows always fit the band: the pick page has
  no scrollbar on either screen (the cards stop at 56 px high and the page takes
  its tight spacing first);
- round 1: the question (with the **yellow flash** after the blind pick, the
  same as on the host's screen) and the answers that have been found. The flash
  goes on the body, so a redraw can never play it a second time, it is over in
  0.8 seconds, and the E marker turns dark while the gold is on, so it can
  still be read;
- the result of the team that has just played, with the answers it found and the
  ones it did not (the words that were not found are on the Round 2 result too).
  The question (or, in Round 2, the category) sits in the **right-hand column,
  just above the answers**, lined up with their right edge, next to the time and
  the count; on a phone it moves back to the left. The result pages are scaled
  down with the screen so the whole page is on the screen: nothing has to be
  scrolled to reach **Next team**, on the host's screen and on the audience
  screen alike;
- the **name of the church** in the top right corner of the audience screen. It
  is set in the Gimme 5 Studio (Settings, *Church name*) and is stored in the
  game file as `church`;
- the Round 1 ranking;
- round 2: the category, the **word that is up** (it always goes to the audience
  screen), the waiting words and the words that have been found;
- the last page, **To God Be the Glory**: both rounds side by side. The Round 1
  table carries a **Round 2** column that says *Qualified* or *Eliminated* for
  every team (the flag is saved with the result, as `in`, so the record keeps it
  too; a record written before the flag existed is read from the Round 2 table,
  so the column is never blank for a finished game). The winner sits in a band in
  the middle of the bottom: the word **Winner** above the band, in the normal ink,
  and the name of the team inside it in the gold of the English marker
  (`--gold-text`), on a tinted panel with the accent rule. `g5WinnerBand()` draws
  it and `g5EndRows()` draws the table, so both screens share one piece of code.

The Word Chain Present window keeps its own mechanism (`?present=1` plus
`postMessage`); both are independent.

**Both audience screens are sized from the window**, so the type and the tiles grow
with the projector: the Gimme 5 question is `min(4.6vw, 84px)`, the slots
`min(7.6vh, 104px)`, the Round 2 word `min(7vw, 130px)`, and the Word Chain tiles
may grow to 260 px instead of the 92 px the operator's screen uses. Everything
sits under `body.present` in `style.css`. The audience screen shows the blind
pick with its numbers, the question and the slots that are found, the result of
the team that has just played, the Round 1 ranking and the Round 2 board.

**The English marker rides with the question.** It is inside the question text
(`<span class="g5-qtext">…<span class="g5-e">E</span></span>`), so it ends the
last line and can never take a line of its own. That extra line was what pushed
a scrollbar onto the audience screen.

**A game screen is one screen tall, and its type is fitted to it.** The stage of
a Gimme 5 screen carries `#stage.g5stage { height: 100dvh }`, so the panel under
it can never make the page taller. After every redraw `g5FitHost()` /
`g5FitPresent()` (`g5FitBox()`) check the height: if the page is too tall, the
stage first gets `g5-tight` (smaller gaps, less air in the tables and the rows,
the small label above a heading dropped, a smaller winner band, a tighter team
grid on the setup page) and then the type of the heading, the sub-headings, the
tables and the winner name shrinks a little at a time. The tables stop shrinking
at 62 % (`12 px` at the smallest) because a table is read row by row. A resize,
and the arrival of the web font, fit the page again. **One pixel of overflow is
overflow** — a scrollbar is a scrollbar — so the fit does not stop at a couple of
pixels; measured on the host and on the audience screen at 1920x1080, 1366x768,
1280x720, 1024x768, 1024x600 and 800x600, ten teams fit both screens with no
scrollbar.

## 7. Game rules implemented (do not break these)

- Word 1 of a round is shown fully in **gold** tiles. Words 2...n are guessed.
- **Box count:** per round, every row has `longest word + random 1-4` boxes (`G.cols`, chosen in `setR`). Rows share one grid, so word length is never revealed up front. No `?` is shown at the beginning.
- **First word to guess in a round:** waits **1.5 s** (`G.hold`, `setTimeout`) before its first letter appears. For following words the first letter appears **immediately** when the host presses *Next word*.
- Every `interval` seconds `tick()` reveals the next letter up to `length-1`; then, **one more interval later**, the last letter's box shows `?` (gold). The last letter itself is never auto-revealed.
- Flip animation uses a per-event flag `G.flip` (`null | letterIndex | 'q'`) so only the newly shown tile animates (an earlier bug flipped the letter before the `?`).
- Host controls: **Reveal word** (Space), **Next word / Next round** (Right arrow), **Previous Round** (Left arrow), **Skip Round**, **Go to round** dropdown, **Pause** (P), **Hint** toggle (H), **Sound**, **Stage theme (Light / Dark)**, **Finish Game**, Exit. Hints show as `(text)` for quoted scripture hints.
- Order of rounds: optional sample -> rounds. Instructions slide appears first, with **Scoring / team setup** (No scoring, 2, 3, 4, 5, 6 or 8 teams, editable names). Scoreboard with minus/plus; keys `1-8` add a point (Shift = -1).
- **Finish:** `endGame()` picks the highest score as winner (tie flagged), saves result via `app_save_result` (`id = Date.now()`), shows winner + **Change winner** dropdown (`setWin`) for operator corrections; early finish offers **Resume Game**. Results only save when teams exist and the DB is connected.
- The stage theme is **independent** of the site theme: `stageTheme()` returns `S.stageTheme || S.theme`, and `S.stageTheme` is stored in `localStorage` key `bbc2` as `stageTheme`.
- **The welcome message** (Series, Title, Sub-title, Date, Welcome phrase) is a new section at the top of the Studio and four new fields in the game JSON. It shows as a block on the instructions slide, and as a **curtain** on the stage in front of the first round (or the sample round): no letter is revealed until the host takes it down with **Begin** (Enter also works). The curtain appears on the second screen as well, without the button, so the operator sets the pace from their own window.
- **Present (second screen):** `present(id)` opens `index.html?present=1` in its own window and starts the game here; `presentLive()` opens it for the game that is already running. The host pushes the stage markup to that window with `postMessage` (`pushPresent`), and the window asks for the state when it loads (`present-ready`). In the present window the top bar, the control panel, the keyboard hints, the team setup form, the change-winner select, the action buttons and the score +/- buttons are all left out: the audience sees the title, the round, the chain, the welcome, the hint, the score and the winner line, and nothing else. A quiet **Exit** link in the corner closes that window (`closePresent`) and leaves the host in control of the game. The window is reused by name, so Present again focuses it instead of opening a second one.

## 8. Styling and branding

- The design system is in **`DESIGN.md`** (tokens, wireframes, measured contrast, critique notes). Read it before changing anything visual.
- Swiss utilitarian: **IBM Plex Sans** (400/500/600/700) only, 8 px spacing, 1 px structural rules, square corners, no shadows, no gradients, no emoji, no rounded cards. Type scale 14 / 16 / 18 / 22 / 28 / 35 / 44 px, body line height 1.5, line length at most 70 characters.
- **Buttons:** one primary per area (solid `--accent`), secondary (1 px `--ink` outline), tertiary (underlined text), destructive (danger-coloured text, two-step confirm). Minimum 48 px, 3 px focus ring in `--accent` with a 2 px offset. Text labels by default; icons only where space is tight (the host strip, the password field).
- **Tiles are the identity:** empty is a 2 px outline, revealed is an accent fill, the given first word is a gold fill, `?` is a gold outline. The same four states are the church mark, the favicon, the hero pattern, the empty states, the finish art and the share image, and they are all drawn in code by `art.js` so they follow the theme and the Admin's colours.
- **Colours:** the admin picks **Base** and **Accent**; `themeVars()` / `stageVars()` in `app.js` derive paper, tint, ink, muted, rule, the control border and on-accent from them, and tune the accent until it reaches 4.5:1 on both the paper and the tint. Gold and danger are fixed per theme. Gold has three jobs only: the given word, the `?` tile and the winner line.
- **Assets:** everything is drawn in code. `art.js` holds `markSVG()` (the church mark: a cross of tiles ending in the gold `?`), `tileHero()` (the Round 6 chain showing all four tile states, 5 rows for the login and 2 rows for the library header), `emptyArt(kind)` (games, search, pending, rounds) and `chainArt(word)` (the finish screen). The files in `assets/` are generated from the same functions. The favicon is rebuilt in `brand()` from the current Base and Accent, so the tab icon follows the branding.
- **The default brand is the new palette** (`base #0A2A1E`, `accent #17794A`). A site that still holds the old v2 brand keeps its own green until the Admin presses **Reset branding** in the branding panel.
- Icons come from the inline SVG sprite in `index.html` (24 px grid, 1.75 px stroke, `currentColor`). Use `<svg class="ic"><use href="#i-play"></use></svg>`.
- Motion: only state changes move (a 180 ms tile reveal, a 120 ms screen fade). `prefers-reduced-motion: reduce` removes all of it.

## 9. Conventions for changes

- Keep it **dependency-free** and **build-free**; no frameworks.
- Add a short `//` comment above every new function (existing style).
- Escape all user text with `esc()`. Never put secrets in the frontend; the anon key is public by design.
- Any new server write must be a `SECURITY DEFINER` RPC in `setup.sql` that checks the token/role. Do not add INSERT/UPDATE policies for anon.
- If you change `setup.sql`, make it **idempotent** (`create or replace`, `if not exists`, `on conflict do nothing`) and tell the owner to re-run it in the SQL Editor.
- Keep `DEF` in `app.js` and the seeded default game in `setup.sql` identical.
- No emoji, no `box-shadow`, no gradient, no `border-radius` above 2px — in code, in copy and in comments. `DESIGN.md` section 1 has the full ban list.
- Prefer small edits; the code is dense one-liners in many places. Do not "reformat everything" in one commit.

## 12. Known limitations to state

- **Games are publicly readable** (Supabase RLS gives anyone read access to
  `app_games`), so the five answers of a Gimme 5 game can be seen by anyone who
  inspects the network data. That is acceptable for a fellowship game; if
  cheating becomes a concern, a later change can move the answers to a
  creator-only table that is only read when the host starts the game.
- The Gimme 5 Present window works between windows of the **same browser on the
  same device** (an extended monitor or a projector). It does not link two
  different devices.
- The Gimme 5 timers use `endsAt` timestamps, so they do not drift, but a
  browser that is fully suspended (a laptop lid closed) may still show a stale
  countdown until the tab wakes up.

## 12a. Known limitations / gotchas

- `confirm()` and `prompt()` are used (delete game, change password). Fine on GitHub Pages; blocked in sandboxed iframes.
- Anyone (including guests) can call `app_save_result`, so fake winner entries are possible. No rate limiting on login.
- Admin "view password" works through reversible encryption (`pw_enc`). Removing that feature would allow hashed-only storage.
- Guests are not stored; deleting a user does not delete their games (`by_name` stays).
- Data refreshes only on `go('lib')`, the Refresh button, or after saving. There is no realtime sync and no polling.
- AI generator is a **simulation** using the `GR` word graph.
- Supabase free projects pause after ~1 week of inactivity (owner must click Restore).
- `SUPABASE_URL` must be just `https://<ref>.supabase.co`; `config.js` is cached by GitHub Pages (hard refresh after edits).
- The code was developed without an automated test suite; nothing has been run against a live Postgres by the authoring assistant except by the owner's manual use. Treat `setup.sql` changes carefully.
- The stage tile size is measured after layout: `renderStage()` renders, measures the header / hint / host strip and sets `--t` (18-92 px). If the host strip grows, the tiles shrink to fit.

## 11. Manual test checklist

1. Fresh load with empty `config.js`: notice shown; Guest can play default game.
2. With real config: Admin login, change password, logout/login again.
3. Register a member -> appears *Pending* -> Approve -> member logs in; Disable -> login blocked; Reset -> `welcome123`; Delete (confirm).
4. Member creates a game (5-word rounds, quick-add 5 and 10 rounds, add word at start, sample round, interval 12 shows warning but saves). Edit and delete it. Another member cannot edit it.
5. Play: instructions -> team setup (2-8) -> sample -> round 1: 1.5 s gap, first letter, timer letters, `?` one interval after last letter, Space reveal, Next word shows first letter at once, Skip Round, Previous Round, Go to round, Pause, Hint.
5a. Welcome message: fill in Series, Title, Sub-title, Date and the welcome phrase in the Studio, save, then play. The welcome shows on the instructions slide and as a curtain in front of the first round: no letter appears until **Begin** is pressed, and the curtain shows on the second screen too.
6. Finish Game: winner = highest score, tie flagged, change winner, Resume Game; Info shows date created and date won; library shows "Last winner".
7. Admin branding: pick a palette, then change the Base and Accent colours, reload on another device and confirm it persists; the preview tiles, the church mark and the "Adjusted for readability" note follow the choice.
8. Open on a second device/browser and confirm games, accounts and branding are shared.
9. Stage theme: switch the stage to Light on the projector screen and confirm it is remembered and that the site theme does not change.
10. Present: press **Present** on a game, move the new window to the second monitor, and confirm the audience view has no navigation and no control panel while the chain, the score and the winner line update live. Press Present again: it should focus the same window, not open a second one. The **Exit** link in the corner of the second screen closes that window only; the host's game carries on.
11. Gimme 5: create one from the library, set the number of teams and how many teams go through to Round 2, add a question with 5 answers, add a set of 5 words to a category (the *Add a set* control takes the category), and save. Play it with 2, 5 and 10 teams: each team blind-picks a question (the boxes stay, the taken ones are marked), the team works together on the five answers (the keys 1 to 5 mark a slot correct, Undo last takes a mistake back). The countdown ends the round and **Reveal remaining** shows what nobody found (the first press), the second press (**Show the result**) ends the round; the button is greyed out while the clock runs, so it can only be used when the clock has stopped. The team result screen shows the time, the answers found and the answers that were not found, and Next team goes back to the blind pick. The ranking comes after the last team and marks who is through.
12. Gimme 5 Round 2: the box pick reveals a category (the page has only the boxes, one for every set), the 5 words come from the set under the box, the board shows the waiting words under *Remaining* in the order they will be played, the word to guess under *Guess* with its number on the left, and the found words under *Found*. The word only appears when the round starts, clicking a card shows that word when the clock is stopped, Correct is greyed out until the round has started, Reveal the rest shows the others without counting them, and **Pass** sends the word that is up to the back so the words run 1, 2, 3, 4, 5 and round again.
13. Gimme 5 flash and clock: pick a box and the question turns gold for a moment
on both screens (once, not twice), and the E marker stays readable on the gold.
The countdown on the audience screen must never show 0:00 and then jump back to
the real time.
14. Gimme 5 Present: press Present, move the window to the projector, and confirm the audience screen shows the game title, its description and the instructions before the first round, then **Pick a number** with the sub text and the boxes, the question with the yellow flash, the answers already found, the team result, the ranking and the Round 2 board **with the word that is up**, and **not** the answers still hidden and **not** the word before the round starts. Use the Fullscreen button in that window.
15. Gimme 5 clock: team 1 takes two seconds, team 2 one. The ranking must show one second and two seconds, not three and one: every team starts from the full time. Pause the clock for a while: the time of the team must not grow while it is paused, and no time may be longer than the time the host set.
16. Gimme 5 safety: while the clock is running, **Reveal remaining**, **Reveal the rest** and the word cards are greyed out and cannot be clicked; the answer slots cannot be clicked at all. Let a clock run out in both rounds: the board stays, the note appears, and the reveal ends the round. After the time is up, click an answer in the operator list: it shows on the board as *not guessed*, it does not count, and it does not jump to the result page (the **Show the result** button does that).

## 12. Backlog ideas (not started)

- Real AI chain generator through a Supabase **Edge Function** (keep the API key server-side).
- Supabase **Realtime** for a shared live scoreboard / remote host controls.
- Member self-service password change; login rate limiting; hash-only passwords.
- Export winners history to CSV; game categories/tags; duplicate-game button.
- Filipino/Tagalog UI text; PWA/offline mode for retreats with poor signal.
- Unit tests for the stage logic (`tick`, `startWord`, `next`) by extracting it from the DOM code.
