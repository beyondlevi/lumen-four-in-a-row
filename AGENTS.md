# Working on this game

A [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) web app: Four in a Row against the
computer, which Lumen runs offline on Rokid glasses from a `.mrbd.zip` package. Lumen's guide for
apps is [docs/building-apps.md](https://github.com/beyondlevi/rokid-lumen/blob/main/docs/building-apps.md).
It doesn't use the UI Toolkit for Meta Ray-Ban Display: it follows its own approved design, drawn
with the DOM.

## Rules

- **The band drives it as keys.** Swipes are arrow keys, the index tap is `Enter`, the middle tap
  is Back (`Escape`, sent to the focused element). Call `preventDefault()` on `Escape` only when
  the game used it (to close the top bar, New game? or How to play): on the board and on the end
  screens it must reach Lumen, which closes the app. Ignore repeated keys.
- **Always one focused element**: the board, a button of the top bar, a row (real `<button>`s),
  or the help screen. Nothing is focused at load.
- **The screen follows the state.** Everything drawn comes from `Game` and is rebuilt by
  `View.render()` (on load, when the page is shown again, after every key and every disc); a fall
  that never finished must not leave a wrong board.
- **The computer never blocks the page.** Its search runs in a worker (`src/ai.worker.ts`, a file
  of the package); Hard stops at its time budget (`HARD_BUDGET_MS`, 600 ms) and "Thinking" shows
  at least 400 ms. Medium and Hard always take a win and block a four you could make next.
- **Save every change.** A hidden app is suspended, and Android may end its page: the game lives
  in `localStorage` under `lumen-four-in-a-row`, and a broken value starts a new game. A game
  saved at the computer's turn goes on when the page comes back.
- **Black is see-through on the glasses**, and their display is green: colors become brightness,
  so the two sides differ in shape (your discs filled, the computer's rings with a dot). Use the
  design's Rokid palette (`src/palette.ts`); texts at least 14 px, only in its bright text colors.
- **The screen is 600 x 600 CSS px** (Lumen's web app square). Animations run at 30 fps there.
- **Offline.** Fonts and everything else ship in the package; nothing loads from the internet.
  The manifest has no `lumen_internet` and no `lumen_config`.
- **English first, multilingual from the start.** Every text lives in `src/i18n.ts`, English by
  default and Brazilian Portuguese (`pt`, for any `pt-*`) with it; placeholders, never
  concatenation; numbers through `Intl.NumberFormat`. Code, comments, docs and commits in English.
- **GeckoView only** (Firefox 156 on the glasses).
- **The name.** The game is "Four in a Row"; never use the trademarked name of the commercial game.

## Commands

- `npm run dev`, `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (after a build: plays
  the game in Chromium and Firefox with the band's keys, screenshots in `.e2e-output/`)
- `npm run package` builds `dist/lumen-four-in-a-row.mrbd.zip`, the package Lumen installs.
