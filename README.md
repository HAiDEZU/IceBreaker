# Bicutan Bible Church - Word Chain Reaction (online edition)

A fellowship game-show / icebreaker website. It is hosted free on **GitHub Pages**, and all accounts, game files, winners history and branding are stored in a free **Supabase** database, so everything is shared across every device.

## Files
| File | Purpose |
|---|---|
| `index.html` | Page skeleton, the SVG icon sprite and the share-preview tags (loads the other files) |
| `style.css` | All colours, layout and animations (commented by section) |
| `art.js` | The SVG drawings: the church mark, the hero pattern, the empty states, the finish art |
| `assets/` | The mark, the favicon, the touch icon and the share image |
| `DESIGN.md` | The design system: colours, type scale, layout, measured contrast |
| `app.js` | All the logic: login, library, studio, admin, game stage (commented function by function) |
| `config.js` | **You edit this**: your Supabase URL and public key |
| `setup.sql` | Run once in Supabase to create the tables and security rules |

## Set-up (once)
1. Create a free project at https://supabase.com.
2. **SQL Editor -> New query**: paste all of `setup.sql` and click **Run**. (Already ran it earlier? You do not need to run it again: this version uses the same database.)
3. **Project Settings -> API**: copy the **Project URL** and the **anon public** key into `config.js`. The URL must look like `https://abcdxyz.supabase.co` only (no `/rest/v1`, not the dashboard link). Never use the `service_role` key.
4. Create a **Public** GitHub repository, upload `index.html`, `style.css`, `app.js`, `art.js`, `assets`, `config.js` and `README.md` (unzip first; `setup.sql` is optional), then **Settings -> Pages -> Deploy from a branch -> main / (root)**.
5. Your site is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.
6. Open `index.html` once and replace the placeholder address in the `og:image` and `twitter:image` tags with your real site address, so the link preview shows the right picture.

Updating later: open a file on GitHub, click the pencil, edit, commit. If you still see the old version, hard refresh (Ctrl+F5).

## First login
Username `haidezu`, password `qwerty5575` (Admin). Change it at once: **Admin -> Account Management -> Change password**.
New members register on the login page and wait in the Admin panel for approval.

## Game Studio quick guide
- **Rounds** start with **5 word boxes**. The first box is the word given to players.
- **Word at start** inserts a new first word, **Word at end** adds a last word, **-** removes a word.
- **Quick add** buttons add **1, 5 or 10 rounds** at once.
- **Sample round**: optional practice round for demonstrating the game (add, edit, **Use the example**, or remove).
- **Auto-reveal interval** is typed in seconds (a warning shows at 10 or more, but you can still save).
- The **Info** button on each game shows who created it, the **date created**, and the winners history with the **date each match was won**.

## Branding
Admin -> Branding sets the church name, a sub-title, a logo image address and two colours: **Base** (the deep tone behind the app and the stage) and **Accent** (the green used for buttons and revealed tiles). Everything else is worked out automatically, and the app will say *Adjusted for readability* if a colour had to be lightened or darkened to stay readable.

## Host keys on the stage
Space reveal · -> next word/round · <- previous round · H hint · P pause · 1-8 team points (Shift for -1).

The **Light / Dark** switch in the host strip changes the stage only (for a bright hall), and the app has its own switch for the rest of the site. Both are remembered in this browser.

## Showing on a second screen
Press **Present** on a game in the library. A second window opens with the audience view of the game: the chain, the round, the score and the winner line, with no navigation and no host controls. Drag that window to the projector or the extended monitor, and keep this window as the control panel: every letter, score and round follows along. Press **Present** again to bring the same window back to the front.

## Good to know
- Supabase free projects pause after about a week of no activity. If the site says it cannot reach the database, open the Supabase dashboard and click **Restore**.
- Passwords are stored as bcrypt hashes for login, plus an encrypted copy so the Admin can use the **View** button. The key never leaves the database.
- Anyone who plays (even a guest) can record a winner for a game; creating, editing and deleting games and all Admin actions are checked on the server.
- The AI Chain Generator is simulated offline using a built-in word list.
