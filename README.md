# Bicutan Bible Church – Word Chain Reaction (online edition)

A fellowship game-show / icebreaker website. The page is hosted free on **GitHub Pages**, and all accounts, game files, winners history and branding are stored in a free **Supabase** database (a spreadsheet-style online database, like Airtable), so everything is shared across every phone, tablet and computer.

Files in this package:

| File | What it is |
|---|---|
| `index.html` | The whole website |
| `config.js` | Where you paste your database URL and key (Step 3) |
| `setup.sql` | Creates the database tables and rules (Step 2) |

## Step 1 – Create the database (5 min)
1. Go to https://supabase.com, sign up (free) and click **New project**. Choose any name and a database password, pick a region near the Philippines (e.g. Singapore), then wait about 2 minutes.

## Step 2 – Create the tables
1. In your project, open **SQL Editor → New query**.
2. Open `setup.sql` from this package, copy everything, paste it in, and click **Run**. You should see "Success".
3. (Optional) Open **Table Editor** to see your data in spreadsheet-style tables: `app_users`, `app_games`, `app_settings`.

## Step 3 – Connect the website
1. In Supabase open **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` and paste them between the quotes:
   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi..."
   ```
   (Never use the `service_role` key here.)

## Step 4 – Upload to GitHub and go online
1. Unzip this package. GitHub does not unpack zips, so upload the files inside it.
2. On https://github.com/new create a **Public** repository (e.g. `word-chain-reaction`).
3. Click **uploading an existing file**, drag in `index.html`, `config.js` and `README.md` (`setup.sql` is optional), then **Commit changes**.
4. Go to **Settings → Pages**, set Source to *Deploy from a branch*, branch **main**, folder **/ (root)**, and Save.
5. After about a minute your site is live for anyone at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

To change anything later: open the file in GitHub, click the pencil icon, edit, and commit.

## First login
- Username `haidezu`, password `qwerty5575` (Admin).
- **Immediately** open **Admin → Account Management → Change password** and set your own. The default password is also in `setup.sql`, so do not leave it.
- New members register on the login page and appear in the Admin panel as *Pending approval* (with a 🔔 on the Admin button). Approve, disable, reset or delete them there.
- Guests only need a nickname. They can play but not save games.

## How your data is protected
- Passwords are stored as bcrypt hashes for login, plus an encrypted copy so the Admin can use the 👁 View button. The encryption key stays inside the database and is never sent to the website.
- Visitors can only read games and branding. Creating, editing, deleting games, and every Admin action are checked on the server against a login token. Editing someone else's game is limited to its creator or the Admin.
- The `anon` key in `config.js` is public by design. It cannot read the user table.
- Anyone who plays (even a guest) can record a winner for a game, which keeps the winners history working without logins.

## Good to know
- Supabase free projects pause after about 1 week with no activity. Open your Supabase dashboard and click **Restore** if the site says it cannot reach the database.
- Guests can still play the default game when the database is not connected, but results are not saved then.
- Backups: in Supabase **Table Editor** you can export any table to CSV.
- Host keys on the game stage: Space reveal · → next word/round · ← previous round · H hint · P pause · 1–8 team points (Shift for −1).
