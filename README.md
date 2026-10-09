# Bicutan Bible Church – Word Chain Reaction

A single-page fellowship game show / icebreaker. No build step, no server, no dependencies: it is just `index.html`.

## Upload to GitHub (manual, no Git needed)

1. Unzip this package on your computer.
2. Go to https://github.com/new, name the repository (e.g. `word-chain-reaction`), set it to **Public**, and click **Create repository**.
3. On the new repo page click **uploading an existing file**.
4. Drag **`index.html`** and **`README.md`** (the files inside the unzipped folder, not the zip itself) into the upload box.
5. Click **Commit changes**.

## Host it free with GitHub Pages

1. In the repo, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch **main** and folder **/ (root)**, then click **Save**.
4. Wait about 1 minute. Your game will be live at:
   `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`

## Updating later

Open the repo, click **Add file → Upload files**, drop in a new `index.html` (same name), and commit. The site refreshes in about a minute.

## Good to know

- Accounts, games, results and branding are saved in each browser's **localStorage**. They are not shared between devices.
- Default admin login: username `haidezu` (password is set in the page source). Anyone can read the page source, so this is not real security. Change the password in `index.html` (search for `qwerty5575`) before sharing the link widely.
- The AI Chain Generator is simulated offline using a built-in word list.
- The page loads Google Fonts (Bebas Neue, Inter). If offline, it falls back to system fonts.

## Host controls (game stage)

- Space: reveal word · Right Arrow: next word / round · Left Arrow: previous round
- H: toggle hint · P: pause · 1–8: +1 point to team (Shift: −1)
