# Four in a Row for Lumen

The classic against the computer for [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen)
glasses, played with the Meta Neural Band. Aim your disc over a column, drop it, and get four in
a row before the computer does. Three levels, a tally kept on the glasses, and the game runs
offline and waits, saved, for your return.

| Band | In the game |
| --- | --- |
| Swipe left, right | Aim: move your disc over the columns (full columns are skipped) |
| Swipe down, or index tap | Drop your disc |
| Swipe up | The top bar: New game, Level, How to play (left and right move, index tap chooses, swipe down goes back) |
| Index tap on Level | Next level: Easy, Medium, Hard (it applies from the computer's next move) |
| Middle tap | Exit (the game is saved); in the top bar, New game? or How to play, back |

On the computer's turn only the swipe up (the top bar) and the middle tap (exit) do something.
At the end of a game, swipe up or down between Play again and Level, and index tap to choose.

## Rules

- The board has 7 columns and 6 rows. A disc dropped in a column falls to the lowest empty cell.
- You and the computer take turns. Your discs are filled; the computer's are rings with a dot,
  and corner marks show its last disc.
- Four of your discs in a line, across, up and down, or on a diagonal, win. A full board with no
  four is a draw.
- Who starts alternates from one game to the next.
- New game in the middle of a game asks first; a game you start over doesn't count.
- The tally (your wins, the computer's, the draws) stays on the glasses across levels.

## Levels

- **Easy** plays at random among the moves that don't hand you a win; it takes a win 7 times in
  10 and blocks yours half the time. Beatable.
- **Medium** looks 4 moves ahead (an alpha-beta search).
- **Hard** searches deeper and deeper (center columns first, a transposition table, a heuristic
  that weighs open lines and which rows their missing discs wait on) until its time budget of
  600 ms runs out.

Medium and Hard always take a win and always block a four you could make next. The search runs
in a worker, so the screen and the band never wait on it.

## Install on the glasses

Download the `.mrbd.zip` from the latest [release](https://github.com/beyondlevi/lumen-four-in-a-row/releases)
and add it from the Lumen companion's Apps tab, or push it to the glasses:

```sh
adb push lumen-four-in-a-row-<version>.mrbd.zip /sdcard/Android/data/dev.lumen.glasses/files/webapps/
```

Lumen installs it the next time its home opens. The game never uses the internet.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173 (arrows, Enter, Escape play it)
npm run typecheck
npm test           # unit tests: the rules, the computer, the screens, the saved game, the texts
npm run package    # dist/lumen-four-in-a-row.mrbd.zip
npm run test:e2e   # after a build: plays it in Chromium (and Firefox, if installed), screenshots in .e2e-output/
```

`CHROME_PATH=/usr/bin/google-chrome E2E_BROWSERS=chromium,firefox npm run test:e2e` uses an
installed Chrome. The game draws with the DOM at 600 x 600 CSS px, the square Lumen gives a web
app, on a black background: black is see-through on the glasses, and their green display turns
colors into brightness, so the two sides differ in shape. The texts are in English and Brazilian
Portuguese (`src/i18n.ts`).

## License

MIT (see [LICENSE](LICENSE)). The fonts, [Bungee](https://github.com/djrrb/Bungee) and
[Chakra Petch](https://github.com/m4rc1e/Chakra-Petch), are under the SIL Open Font License 1.1
(`public/fonts/OFL-*.txt`).
