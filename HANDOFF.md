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
index.html   Page skeleton. Loads style.css, config.js, art.js, app.js. Contains <div id="app"> and the SVG icon sprite.
style.css    All styles, grouped by section comments. Colours are CSS variables.
art.js       The SVG generators: markSVG, tileHero, emptyArt, chainArt. Touches no DOM, so node can run it.
assets/      mark.svg, favicon.svg, apple-touch-icon.png, og-image.svg, og-image.png
DESIGN.md    The design system: tokens, wireframes, measured contrast, critique notes.
app.js       ALL application logic (~470 lines, dense; every function has a comment above it).
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
| Library | `libV, infoModal, delGame, refresh, emptyState, heroArt` — a list (one row per game), not a card grid, under a 2-row strip of the hero pattern. Search, All/Mine filter and Refresh sit above the list on one line. Each row has the facts (rounds, seconds per letter, creator, last winner) and the actions **Play** (primary), **Present** (secondary), Info, Edit, Delete. |
| Info (winners history) | `infoModal` — a native `<dialog>` (focus trapped, Esc closes, backdrop click closes) with creator, date created and a plain table: date won, winner, score, hosted by. |
| Studio | `newGame, editGame, studioV, wordEditor, addRounds, saveGame, aiGen, walk, emptyState` — one column form. The first section is the **Welcome message** (Series, Title, Sub-title, Date, Welcome phrase), then Settings (description, reveal interval, instructions), Sample round, Generator and the numbered rounds. Word inputs are joined by a short connector rule. |
| Admin | `adminV, delBtn, uact, viewPw, chgPw, loadUsers, accentNote, updPreview, bsave, emptyArt, applyPal` — accounts as a real table (sticky header, pending accounts first with **Approve** as the primary action, a "No accounts are waiting" empty state) and the Branding Customizer: a row of six **palettes** (`PAL`) that set the base and the accent together, then name, sub-title, logo URL, **Base colour**, **Accent colour**, a preview of the four tile states and the church mark, and a "Reset branding" button. Brand saves are debounced (700 ms) via `app_save_brand`. |
| Stage | `play, setR, startWord, tick, reveal, next, prev, skip, skipSample, endGame, finish, saveResult, setWin, resume, fit, fitTiles, stageBody, renderStage, setTeams, sc, setStageTheme, stageBrand, stageTheme, hasWelcome, welcomeBlock, welcomePanel, dismissWelcome` — the control panel at the bottom is in three labelled groups: **Navigation** (Previous round, Go to round, Next word, Skip round), **Tools** (Reveal word, Pause, Hint, Sound, Stage theme, Present) and **Finish** (Finish game, Exit). |
| Second screen | `present, presentLive, openPresent, pushPresent, presentIntro, presentBoot, renderPresent, closePresent` |

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

## 10. Known limitations / gotchas

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

## 12. Backlog ideas (not started)

- Real AI chain generator through a Supabase **Edge Function** (keep the API key server-side).
- Supabase **Realtime** for a shared live scoreboard / remote host controls.
- Member self-service password change; login rate limiting; hash-only passwords.
- Export winners history to CSV; game categories/tags; duplicate-game button.
- Filipino/Tagalog UI text; PWA/offline mode for retreats with poor signal.
- Unit tests for the stage logic (`tick`, `startWord`, `next`) by extracting it from the DOM code.
