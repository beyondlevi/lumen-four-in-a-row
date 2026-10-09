// Plays the built game in a real browser with the band's keys and saves a screenshot of each
// screen to .e2e-output/. Run after `npm run build`: node tests/e2e/run.mjs.
// CHROME_PATH=/path/to/chrome uses an installed Chrome instead of Playwright's Chromium;
// E2E_BROWSERS=chromium,firefox picks the engines (default: chromium, plus firefox if installed).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium, firefox} from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dist = path.join(root, 'dist');
const out = path.join(root, '.e2e-output');
fs.mkdirSync(out, {recursive: true});

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(dist, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'}).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

// The palette's text colors: text, sub, hint, accent (and ring), and the chips' text.
const TEXT_COLORS = ['#E2FFEE', '#B8FFD6', '#8DF0B5', '#F0FFF6', '#021008'];

const EMPTY = ['.......', '.......', '.......', '.......', '.......', '.......'];
// The design's middle game, your turn (the computer's last disc at row 3, column 4).
const MID = ['.......', '.......', '.......', '..YCC..', '..CYY..', 'YCYYCC.'];
// The same after you blocked its diagonal: the computer's turn.
const AFTER_BLOCK = ['.......', '.......', '....Y..', '..YCC..', '..CYY..', 'YCYYCC.'];
// Your turn: column 3 makes four on the diagonal (the design's win, one disc short).
const WIN_NEXT = ['.......', '.......', '.......', '..YCY..', '.YCYC..', 'YCCYYCC'];
// The computer's turn: column 4 makes its four on the diagonal (the design's loss).
const LOSS_NEXT = ['.......', '.......', '...Y...', '..YCC..', '..CYY..', 'YCYYCC.'];
// Your turn, one cell left (column 1): it fills the board with no four (the design's draw).
const DRAW_NEXT = ['C.CYCYC', 'YCYYYCY', 'YYYCCYC', 'CCCYCCC', 'YCYCYYY', 'YCCYYCC'];
const TALLY = {you: 3, cpu: 1, draw: 0};

async function playIn(browser, name, lang) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(base)) external.push(r.url()); });

  const pt = lang !== 'en';
  const tag = pt ? `${name}-pt` : name;
  const t = (label) => `${tag}: ${label}`;
  const url = `${base}?test=1&seed=42&lang=${pt ? 'pt-PT' : 'en'}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__four && document.fonts.status === 'loaded' && !document.getElementById('game').classList.contains('loading'));
    await page.waitForTimeout(200);
  };
  await page.goto(url);
  await ready();

  const state = () => page.evaluate(() => window.__four.state());
  const shot = (file) => page.screenshot({path: path.join(out, `${tag}-${file}.png`)});
  const key = async (k, wait = 60) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const set = (rows, turn, options) => page.evaluate(([r, tn, o]) => window.__four.set(r, tn, o), [rows, turn, options]);
  const text = (selector) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, selector);
  const visible = (selector) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && el.getClientRects().length > 0; }, selector);
  /** Waits until the state matches [predicate] (a function of the state, run in the page). */
  const until = async (predicate, timeout = 6000) => {
    try {
      await page.waitForFunction(`(${predicate})(window.__four.state())`, null, {timeout, polling: 25});
      return true;
    } catch {
      return false;
    }
  };
  const yourTurn = () => until('(s) => s.turn === "you" && !s.falling && s.screen === "board"');
  // Lumen's Back: an Escape keydown and keyup sent to the focused element. True if the page took it.
  const back = () => page.evaluate(() => {
    const target = document.activeElement ?? document.body;
    const init = {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true};
    const down = new KeyboardEvent('keydown', init);
    target.dispatchEvent(down);
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    return down.defaultPrevented;
  });
  /** A key as a cancelable event on the focused element: true if the game prevented it. */
  const prevented = (k) => page.evaluate((k) => {
    const target = document.activeElement ?? document.body;
    const down = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true});
    target.dispatchEvent(down);
    return down.defaultPrevented;
  }, k);
  /** The discs drawn on screen, as rows, from the board's cells. */
  const drawn = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll('.board .cell')].map((cell) => (cell.querySelector('.disc.you') ? 'Y' : cell.querySelector('.disc.cpu') ? 'C' : '.'));
    return [0, 1, 2, 3, 4, 5].map((r) => cells.slice(r * 7, r * 7 + 7).join(''));
  });
  /** Texts under 14 px, out of the 600 x 600 screen, overflowing their box, or in a faint color. */
  const layout = () => page.evaluate((colors) => {
    const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    const problems = [];
    for (const el of document.querySelectorAll('#game *')) {
      if (!el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className}`;
      if (style.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) problems.push(`${name} overflows ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.width > 0 && (r.left < -0.5 || r.right > 600.5 || r.top < -0.5 || r.bottom > 600.5) && !el.closest('.fall')) problems.push(`${name} off screen ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      if (parseFloat(style.fontSize) < 14) problems.push(`${name} ${style.fontSize}`);
      // Inside its parent's padding.
      const parent = el.parentElement;
      if (style.position !== 'absolute' && parent && parent.id !== 'game') {
        const p = parent.getBoundingClientRect();
        const ps = getComputedStyle(parent);
        const inner = {
          left: p.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft) - 1,
          right: p.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight) + 1,
        };
        if (r.left < inner.left || r.right > inner.right) problems.push(`${name} outside its parent's padding ${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(inner.left)}..${Math.round(inner.right)}`);
      }
      if (!colors.includes(hex(style.color))) problems.push(`${name} color ${hex(style.color)}`);
    }
    return problems;
  }, TEXT_COLORS);
  const checkLayout = async (label) => {
    const problems = await layout();
    check(t(`${label}: texts >= 14 px, bright, inside the screen`), problems.length === 0, problems.join('; '));
  };

  // 1. First open: the empty board, your disc over the middle column, the card.
  let s = await state();
  check(t('a new game: empty board, your turn, the first card'), s.screen === 'board' && s.turn === 'you' && s.firstCard && JSON.stringify(s.rows) === JSON.stringify(EMPTY) && await visible('.first'));
  check(t('the board has the focus'), s.active === 'board', s.active);
  const box = await page.evaluate(() => document.getElementById('game').getBoundingClientRect().toJSON());
  check(t('the game fits in 600 x 600'), box.left >= 0 && box.top >= 0 && box.right <= 600 && box.bottom <= 600 && box.width === 600 && box.height === 600, JSON.stringify(box));
  check(t('the tally starts at 0 0 0'), JSON.stringify(s.tally) === JSON.stringify({you: 0, cpu: 0, draw: 0}));
  await checkLayout('first open');
  await shot('01-first');

  // 2. Aim: left and right move your disc over the columns.
  const hoverX = () => page.evaluate(() => Math.round(document.querySelector('.hover').getBoundingClientRect().left));
  const x3 = await hoverX();
  await key('ArrowRight');
  s = await state();
  check(t('right aims one column right'), s.aim === 4 && (await hoverX()) === x3 + 66, `aim ${s.aim}`);
  await key('ArrowLeft');
  await key('ArrowLeft');
  check(t('left aims one column left'), (await state()).aim === 2 && (await hoverX()) === x3 - 66);
  await key('ArrowRight');
  check(t('the ghost shows where it lands'), await page.evaluate(() => [...document.querySelectorAll('.board .cell')].findIndex((c) => c.querySelector('.ghost')) === 38));

  // 3. Drop: your disc falls, the card goes, the computer thinks, then replies.
  const dropped = Date.now();
  await key('ArrowDown', 0);
  s = await state();
  check(t('down drops your disc in the column'), s.rows[5] === '...Y...' && s.turn === 'cpu' && !s.firstCard, s.rows[5]);
  check(t('it falls (animated)'), s.falling && await visible('.fall'));
  check(t('during the computer turn the keys wait'), (await prevented('ArrowLeft')) && (await prevented('Enter')) && (await state()).rows[5] === '...Y...' && (await state()).aim === 3);
  check(t('the first card is gone'), !(await visible('.first')));
  await until('(s) => !s.falling');
  check(t('"Thinking" shows on the computer turn'), (await visible('.thinking')) && !(await visible('.hover')) && (await text('.foot')).length > 0);
  check(t('Escape on the computer turn is not prevented'), (await back()) === false && (await state()).screen === 'board');
  check(t('the computer replies'), await yourTurn(), JSON.stringify((await state()).rows));
  const took = Date.now() - dropped;
  s = await state();
  check(t('the computer took its time: the fall, then Thinking >= 400 ms'), took >= 650, `${took} ms`);
  check(t('its disc is on the board, marked'), s.rows.join('').split('C').length - 1 === 1 && s.last >= 0 && await visible('.board .mark'));
  check(t('the board on screen is the state'), JSON.stringify(await drawn()) === JSON.stringify(s.rows), JSON.stringify(await drawn()));

  // 4. The design's playing board.
  await set(MID, 'you', {last: [3, 4], tally: TALLY, aim: 3});
  await page.waitForTimeout(100);
  s = await state();
  check(t('the playing board as designed'), JSON.stringify(await drawn()) === JSON.stringify(MID) && s.last === 25 && s.aim === 3);
  await checkLayout('board');
  await shot('02-main');
  check(t('Escape on the board is not prevented (Lumen closes the app)'), (await back()) === false && (await state()).screen === 'board');

  // 5. The top bar: up opens it on Level; the index tap cycles Easy, Medium, Hard; left and right move.
  await key('ArrowUp');
  s = await state();
  check(t('up opens the top bar on Level'), s.screen === 'bar' && s.active === 'level' && await visible('.bar-wrap') && !(await visible('.head')), `${s.screen} ${s.active}`);
  await checkLayout('top bar');
  await shot('03-topbar');
  const levels = [];
  for (let i = 0; i < 3; i++) {
    await key('Enter');
    levels.push((await state()).level);
  }
  check(t('the index tap cycles the level'), levels.join() === 'hard,easy,medium', levels.join());
  check(t('the level shows in the bar'), (await text('.bar .lv.on')) === (pt ? 'Médio' : 'Medium'), await text('.bar .lv.on'));
  const path1 = [];
  for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
    await key(k);
    path1.push((await state()).active);
  }
  check(t('left and right move between the buttons'), path1.join() === 'new,new,level,howto,howto', path1.join());
  await key('ArrowLeft');
  await key('ArrowLeft');
  check(t('only the focused button shows its label'), await page.evaluate(() => [...document.querySelectorAll('.bar-label')].filter((l) => l.getClientRects().length).map((l) => l.closest('button').dataset.bar).join() === 'new'));
  await checkLayout('top bar on New game');
  await shot('04-topbar-new');
  check(t('Escape in the top bar is prevented and goes back to the board'), (await back()) === true && (await state()).screen === 'board' && (await state()).active === 'board');
  await key('ArrowUp');
  await key('ArrowDown');
  check(t('down goes back to the board'), (await state()).screen === 'board');

  // 6. New game in the middle of one asks first.
  await key('ArrowUp');
  await key('ArrowLeft');
  await key('Enter');
  s = await state();
  check(t('New game asks first'), s.screen === 'newgame' && s.active === 'start' && await visible('.newgame'));
  await checkLayout('new game');
  await shot('05-newgame');
  check(t('Escape on New game? goes back to the bar'), (await back()) === true && (await state()).screen === 'bar' && (await state()).active === 'new');
  await key('Enter');
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(t('Keep playing keeps the game'), s.screen === 'board' && JSON.stringify(s.rows) === JSON.stringify(MID) && s.turn === 'you');
  await key('ArrowUp');
  await key('ArrowLeft');
  await key('Enter');
  await key('Enter');
  s = await state();
  check(t('Start over: a new game, the tally kept, the computer starts this one'), JSON.stringify(s.rows) === JSON.stringify(EMPTY) && JSON.stringify(s.tally) === JSON.stringify(TALLY) && s.starter === 'cpu' && s.turn === 'cpu');
  check(t('the computer opens the new game'), await yourTurn() && (await state()).rows[5].includes('C'));

  // 7. How to play, and back to the bar.
  await key('ArrowUp');
  await key('ArrowRight');
  await key('Enter');
  s = await state();
  check(t('How to play'), s.screen === 'howto' && await visible('.howto') && !(await visible('.board')));
  await checkLayout('how to play');
  await shot('06-howto');
  check(t('Escape on How to play goes back to the bar'), (await back()) === true && (await state()).screen === 'bar' && (await state()).active === 'howto');
  await key('Enter');
  await key('Enter');
  check(t('the index tap goes back too'), (await state()).screen === 'bar');
  await key('ArrowDown');

  // 8. The computer's turn as designed: Thinking, then its disc falls.
  await set(AFTER_BLOCK, 'cpu', {tally: TALLY});
  await page.waitForTimeout(120);
  s = await state();
  check(t('the computer turn: Thinking, no disc over the board'), s.thinking && (await visible('.thinking')) && !(await visible('.hover')));
  await checkLayout('computer turn');
  await shot('07-thinking');
  check(t('the up key opens the bar on the computer turn'), (await prevented('ArrowUp')) && (await state()).screen === 'bar');
  await key('ArrowDown');
  check(t('its disc falls'), await until('(s) => s.falling', 4000));
  await page.waitForTimeout(90);
  await shot('08-falling');
  check(t('then it is your turn'), await yourTurn());

  // 9. A forced win: you complete the diagonal.
  await set(WIN_NEXT, 'you', {tally: TALLY, aim: 3});
  await key('ArrowDown');
  check(t('your four ends the game'), await until('(s) => s.screen === "end" && !s.falling'));
  s = await state();
  check(t('You win: the tally counts it, Play again focused'), s.result === 'you' && s.tally.you === 4 && s.active === 'play' && await visible('.win-line') && await visible('.result'));
  check(t('the tally chip on YOU'), await page.evaluate(() => document.querySelector('.result [data-tally="you"] .t-value').classList.contains('gain')));
  check(t('Play again says the computer starts'), (await text('.end-rows .row-note')) === (pt ? 'computador começa' : 'computer starts'), await text('.end-rows .row-note'));
  await checkLayout('you win');
  await shot('09-youwin');
  check(t('Escape on an end screen is not prevented (exit)'), (await back()) === false && (await state()).screen === 'end');
  await key('ArrowDown');
  check(t('down: the Level row'), (await state()).active === 'level');
  await key('Enter');
  check(t('the index tap on Level cycles it'), (await state()).level === 'hard');
  await key('ArrowUp');
  await key('Enter');
  s = await state();
  check(t('Play again: a new game, the computer starts'), s.screen === 'board' && s.starter === 'cpu' && s.level === 'hard');

  // 10. A forced loss: the computer completes its diagonal (at Medium).
  await yourTurn();
  await page.evaluate(() => window.__four.level('medium'));
  await set(LOSS_NEXT, 'cpu', {tally: TALLY});
  check(t('the computer takes its win'), await until('(s) => s.screen === "end" && !s.falling'));
  s = await state();
  check(t('Computer wins: counted'), s.result === 'cpu' && s.tally.cpu === 2 && s.active === 'play' && JSON.stringify(s.line.cells) === '[18,24,30,36]');
  await checkLayout('computer wins');
  await shot('10-cpuwins');

  // 11. A forced draw: your disc fills the board.
  await set(DRAW_NEXT, 'you', {tally: TALLY});
  const nextBefore = (await state()).next;
  await key('ArrowDown');
  check(t('a full board with no four is a draw'), await until('(s) => s.screen === "end" && !s.falling'));
  s = await state();
  check(t('Draw: counted'), s.result === 'draw' && s.tally.draw === 1 && !(await visible('.win-line')));
  await checkLayout('draw');
  await shot('11-draw');
  await key('Enter');
  s = await state();
  check(t('Play again: who starts alternates'), s.starter === nextBefore && s.next !== nextBefore, `${nextBefore} starts this one, ${s.next} the next`);
  await page.waitForTimeout(100);

  // 12. Hard thinks within its budget.
  await yourTurn();
  await page.evaluate(() => window.__four.level('hard'));
  await set(AFTER_BLOCK, 'cpu', {tally: TALLY});
  const asked = Date.now();
  await yourTurn();
  const hardMs = Date.now() - asked;
  check(t('Hard replies in time'), hardMs < 600 + 400 + 600, `${hardMs} ms`);

  // 13. A reload brings the same game back, also at the computer's turn.
  // You block its diagonal in column 5; it replies; the game goes on.
  await set(MID, 'you', {last: [3, 4], tally: TALLY, aim: 4});
  await key('ArrowDown');
  check(t('you block, it replies'), await yourTurn());
  const kept = await state();
  await page.reload();
  await ready();
  s = await state();
  check(t('a reload keeps the game'), JSON.stringify(s.rows) === JSON.stringify(kept.rows) && s.turn === kept.turn && s.level === kept.level && JSON.stringify(s.tally) === JSON.stringify(kept.tally) && s.aim === kept.aim && s.last === kept.last && !s.firstCard);
  check(t('and draws it, the board focused'), JSON.stringify(await drawn()) === JSON.stringify(s.rows) && s.active === 'board', `${s.active} ${JSON.stringify(await drawn())} ${JSON.stringify(s.rows)}`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen-four-in-a-row')));
  check(t('saved under "lumen-four-in-a-row"'), JSON.stringify(saved.board) === JSON.stringify(s.rows) && saved.firstSeen === true && saved.level === 'hard');
  await set(AFTER_BLOCK, 'cpu', {tally: TALLY});
  await page.reload();
  await ready();
  check(t('a reload on the computer turn comes back to it'), (await state()).thinking && JSON.stringify((await state()).rows) === JSON.stringify(AFTER_BLOCK));
  check(t('and the computer goes on'), await yourTurn() && (await state()).rows.join('').split('C').length - 1 === 7);
  // A broken save starts a new game. It's written from a page of the same origin that isn't the
  // game: the game saves itself when it's hidden, so it would write over it on the way out.
  await page.goto(`${base}fonts/OFL-Bungee.txt`);
  await page.evaluate(() => localStorage.setItem('lumen-four-in-a-row', '{broken'));
  await page.goto(url);
  await ready();
  s = await state();
  check(t('a broken save starts a new game'), s.screen === 'board' && JSON.stringify(s.rows) === JSON.stringify(EMPTY) && s.turn === 'you');

  check(t('no page errors'), errors.length === 0, errors.join(' | '));
  check(t('nothing loaded from outside the package'), external.length === 0, external.join(', '));
  await context.close();
}

async function play(browserType, name) {
  const browser = await browserType.launch(process.env.CHROME_PATH && name === 'chromium' ? {executablePath: process.env.CHROME_PATH} : {});
  try {
    for (const lang of ['en', 'pt']) await playIn(browser, name, lang);
  } finally {
    await browser.close();
  }
}

const wanted = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',');
const engines = {chromium, firefox};
for (const name of wanted) {
  try {
    await play(engines[name], name);
  } catch (error) {
    if (name === 'firefox' && !process.env.E2E_BROWSERS && /Executable doesn't exist/.test(String(error))) {
      console.log('skip firefox (not installed)');
      continue;
    }
    console.log(`FAIL ${name}: ${error.message}`);
    failures++;
  }
}
server.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
