import type {Level} from './ai';
import {CELLS, COLS, CPU, type Disc, EMPTY, ROWS, YOU, colOf, rowOf} from './board';
import {BAR, type BarButton, type Drop, type Game, type RowId, type Screen, type Tally} from './game';
import {type Strings, fill} from './i18n';
import {brackets, icon, levelIcon, miniFour, trail} from './icons';
import {UI, ringOf} from './palette';

/** The playing board: 486 x 420, 66 px cells (as large as the header and footer allow). */
export const PLAY = {left: 57, top: 136, pitch: 66};
/** The board on an end screen: 388 x 336, with room for the rows under it. */
export const END = {left: 106, top: 72, pitch: 52};
/** Your disc, held over the board. */
const HOVER_TOP = 64;
const DISC = PLAY.pitch - 12;
const LEVEL_BARS: Record<Level, number> = {easy: 1, medium: 2, hard: 3};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, value: string): HTMLElementTagNameMap[K] {
  const el = h(tag, className);
  el.textContent = value;
  return el;
}

/** A disc of [size] px outside the board (the legend, the help screen): yours filled, its a ring. */
function disc(side: typeof YOU | typeof CPU, size: number): string {
  if (side === YOU) return `<span class="disc you" style="width: ${size}px; height: ${size}px"></span>`;
  const {ring, dot} = ringOf(size);
  return `<span class="disc cpu" style="width: ${size}px; height: ${size}px; border-width: ${ring}px">` +
    `<i style="width: ${dot}px; height: ${dot}px"></i></span>`;
}

/** The x of the center of column [col] of the playing board. */
const columnX = (col: number) => PLAY.left + 12 + col * PLAY.pitch + PLAY.pitch / 2;
/** The top of a disc in row [row] of the playing board. */
const rowTop = (row: number) => PLAY.top + 12 + row * PLAY.pitch + (PLAY.pitch - DISC) / 2;

/** How long a disc takes to fall [px] (about 30 fps on the glasses: 5 to 11 frames). */
export function fallMs(px: number): number {
  return Math.round(150 + 0.5 * px);
}

/**
 * Draws the game with the DOM. Everything on screen follows from the game's state: [render]
 * rebuilds it, so a fall that never finished (a hidden page, a quick key) can't leave a wrong board.
 */
export class View {
  /** Called when a top bar button or a row is clicked (a mouse, in a desktop browser). */
  onBar: (button: BarButton) => void = () => {};
  onActivate: (index: number) => void = () => {};

  private readonly head: HTMLElement;
  private readonly miniLevel: HTMLElement;
  private readonly miniLevelIcon: HTMLElement;
  private readonly tallies: {el: HTMLElement; values: Record<keyof Tally, HTMLElement>}[] = [];
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultSub: HTMLElement;
  private readonly barWrap: HTMLElement;
  private readonly barButtons: HTMLButtonElement[];
  private readonly barLevelIcon: HTMLElement;
  private readonly barLevels: HTMLElement;
  private readonly barHint: HTMLElement;
  private readonly thinking: HTMLElement;
  private readonly hover: HTMLElement;
  private readonly board: HTMLElement;
  private readonly cells: HTMLElement[] = [];
  private readonly winLine: SVGSVGElement;
  private readonly fall: HTMLElement;
  private readonly first: HTMLElement;
  private readonly howto: HTMLElement;
  private readonly newgame: HTMLElement;
  private readonly newRows: HTMLButtonElement[];
  private readonly endRows: HTMLElement;
  private readonly endButtons: HTMLButtonElement[];
  private readonly endNote: HTMLElement;
  private readonly endLevelIcon: HTMLElement;
  private readonly endLevels: HTMLElement;
  private readonly foot: HTMLElement;
  /** The disc falling now, and the timer that ends its fall. */
  private falling: {drop: Drop; timer: number} | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly strings: Strings,
    private readonly format: (n: number) => string,
  ) {
    for (const [key, value] of Object.entries(UI)) root.style.setProperty(`--${key}`, value);
    const s = strings;

    // Header: the wordmark, the small top bar, the tally.
    this.head = h('header', 'head');
    const logo = h('div', 'logo');
    logo.append(text('span', 'logo-top bungee', s.wordTop), text('span', 'logo-bottom bungee', s.wordBottom));
    const mini = h('div', 'minibar');
    this.miniLevelIcon = h('span', 'mb-icon');
    this.miniLevel = text('span', 'mb-label', '');
    const miniLevelButton = h('div', 'mb wide');
    miniLevelButton.append(this.miniLevelIcon, this.miniLevel);
    mini.append(h('div', 'mb', icon('new', 22)), miniLevelButton, h('div', 'mb', icon('help', 22)));
    this.head.append(logo, mini, this.tally());

    // The end screens' header: the result and the tally.
    this.result = h('header', 'result');
    const words = h('div', 'result-words');
    this.resultTitle = h('span', 'result-title bungee');
    this.resultSub = h('span', 'result-sub');
    words.append(this.resultTitle, this.resultSub);
    this.result.append(words, this.tally());

    // The open top bar: New game, Level, How to play. Only the focused button shows its label.
    this.barWrap = h('div', 'bar-wrap');
    const bar = h('div', 'bar');
    this.barLevelIcon = h('span', 'bar-icon');
    this.barLevels = h('span', 'levels');
    const labels: Record<BarButton, string> = {new: s.newGame, level: s.level, howto: s.howToPlay};
    this.barButtons = BAR.map((id) => {
      const button = h('button', 'bar-btn');
      button.type = 'button';
      button.dataset.bar = id;
      button.setAttribute('aria-label', labels[id]);
      if (id === 'level') button.append(this.barLevelIcon);
      else button.append(h('span', 'bar-icon', icon(id === 'new' ? 'new' : 'help', 24)));
      button.append(text('span', 'bar-label', labels[id]));
      if (id === 'level') button.append(this.barLevels);
      button.addEventListener('click', () => this.onBar(id));
      return button;
    });
    bar.append(...this.barButtons);
    this.barHint = h('div', 'bar-hint');
    this.barWrap.append(bar, this.barHint);

    // The computer's turn.
    this.thinking = h('div', 'thinking', `${disc(CPU, 24)}`);
    this.thinking.append(text('span', 'thinking-label', s.thinking), h('span', 'dots', '<i></i><i></i><i></i>'));

    // Your disc, held over the column you aim at.
    this.hover = h('div', 'hover', `<span class="disc you big"></span>` +
      '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3 L9 10 L15 3"/></svg>');

    // The board: 42 cells, row by row from the top.
    this.board = h('div', 'board play');
    this.board.tabIndex = -1;
    this.board.setAttribute('aria-label', s.board);
    for (let i = 0; i < CELLS; i++) {
      const cell = h('div', 'cell');
      this.cells.push(cell);
      this.board.append(cell);
    }
    this.winLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.winLine.classList.add('win-line');
    this.winLine.setAttribute('aria-hidden', 'true');
    this.fall = h('div', 'fall');

    // First open: aim, then drop.
    this.first = h('section', 'first');
    const arrows = h('div', 'first-arrows', icon('left', 34) + `<span class="first-drop">${disc(YOU, 26)}${icon('down', 26)}</span>` + icon('right', 34));
    const legend = h('div', 'legend');
    legend.innerHTML = disc(YOU, 24);
    legend.append(text('span', 'legend-you', s.you));
    legend.insertAdjacentHTML('beforeend', disc(CPU, 24));
    legend.append(text('span', 'legend-cpu', s.computer));
    this.first.append(arrows, text('span', 'first-title bungee', s.firstTitle), text('span', 'first-text', s.firstText), legend);

    // How to play.
    this.howto = h('section', 'howto');
    this.howto.tabIndex = -1;
    const how = (picture: string, title: string, body: string) => {
      const row = h('div', 'how');
      const what = h('div', 'how-words');
      what.append(text('span', 'how-title', title), text('span', 'how-text', body));
      row.append(h('div', 'how-icon', picture), what);
      return row;
    };
    const mark = `<span class="how-mark">${disc(CPU, 32)}${brackets(44, 10, 2.6)}</span>`;
    this.howto.append(
      text('span', 'howto-title bungee', s.howTitle),
      how(`<span class="how-pair">${disc(YOU, 34)}${disc(CPU, 34)}</span>`, s.howSides, s.howSidesText),
      how(icon('left', 26) + icon('down', 26) + icon('right', 26), s.howAim, s.howAimText),
      how(miniFour(UI.you, UI.youRim, UI.bg, UI.win), s.howFour, s.howFourText),
      how(mark, s.howLast, s.howLastText),
      h('div', 'rule'),
      text('span', 'howto-controls', s.howControls),
    );

    // New game?
    this.newgame = h('section', 'panel newgame');
    const newHead = h('div', 'panel-head');
    newHead.append(text('span', 'panel-title bungee', s.newTitle), text('span', 'panel-sub', s.newText));
    const newList = h('div', 'rows');
    this.newRows = [this.row('start', icon('new'), s.startOver, 0), this.row('keep', icon('back'), s.keepPlaying, 1)];
    newList.append(...this.newRows);
    this.newgame.append(newHead, newList);

    // The end screens' rows: play again (who starts), and the level.
    this.endRows = h('div', 'end-rows');
    this.endNote = h('span', 'row-note');
    this.endLevelIcon = h('span', 'row-icon');
    this.endLevels = h('span', 'levels');
    const play = this.row('play', icon('play'), s.playAgain, 0);
    play.append(this.endNote);
    const level = this.row('level', '', s.level, 1);
    level.prepend(this.endLevelIcon);
    level.append(this.endLevels);
    this.endButtons = [play, level];
    this.endRows.append(play, level);

    this.foot = h('footer', 'foot');
    root.append(this.head, this.result, this.barWrap, this.thinking, this.hover, this.board, this.winLine, this.fall,
      this.first, this.howto, this.newgame, this.endRows, this.foot);
  }

  private tally(): HTMLElement {
    const el = h('div', 'tally');
    const s = this.strings;
    const values = {} as Record<keyof Tally, HTMLElement>;
    for (const [key, label] of [['you', s.tallyYou], ['cpu', s.tallyCpu], ['draw', s.tallyDraw]] as const) {
      const column = h('div', 't-col');
      values[key] = text('span', 't-value', '0');
      column.dataset.tally = key;
      column.append(text('span', 't-label', label), values[key]);
      el.append(column);
    }
    this.tallies.push({el, values});
    return el;
  }

  /** A row of a list: a real button, so a click works too. */
  private row(id: RowId, iconHtml: string, label: string, index: number): HTMLButtonElement {
    const button = h('button', 'row', iconHtml);
    button.type = 'button';
    button.dataset.row = id;
    button.append(text('span', 'row-label', label));
    button.addEventListener('click', () => this.onActivate(index));
    return button;
  }

  private levelName(level: Level): string {
    return this.strings[level];
  }

  /** The three levels, the current one in a chip. */
  private levels(el: HTMLElement, current: Level): void {
    el.replaceChildren(...(['easy', 'medium', 'hard'] as const).map((level) => text('span', level === current ? 'lv on' : 'lv', this.levelName(level))));
  }

  /** Whether a disc is falling now. */
  get busy(): boolean {
    return this.falling !== null;
  }

  /** Draws the whole state. While a disc falls, the board shows the turn before it landed. */
  render(): void {
    const game = this.game;
    const s = this.strings;
    const fall = this.falling?.drop ?? null;
    // A drop that ended the game: the board until the disc lands, then the end screen.
    const screen: Screen = fall && game.screen === 'end' ? 'board' : game.screen;
    const playing = screen === 'board' || screen === 'bar' || screen === 'newgame';
    const ended = screen === 'end';
    const cpuTurn = fall ? fall.side === CPU : game.thinking;
    const aiming = screen === 'board' && !fall && game.yourTurn;

    this.root.classList.toggle('dim', screen === 'newgame');
    this.head.hidden = !(screen === 'board' || screen === 'newgame');
    this.result.hidden = !ended;
    this.barWrap.hidden = screen !== 'bar';
    this.thinking.hidden = !(screen === 'board' && cpuTurn);
    this.hover.hidden = !aiming;
    this.board.hidden = !(playing || ended);
    this.board.classList.toggle('play', !ended);
    this.board.classList.toggle('end', ended);
    this.board.classList.toggle('dimmed', screen === 'bar' || screen === 'newgame');
    this.first.hidden = !(game.firstCard && !fall);
    this.howto.hidden = screen !== 'howto';
    this.newgame.hidden = screen !== 'newgame';
    this.endRows.hidden = !ended;
    if (!fall) this.fall.hidden = true;

    // The header: the level and the tally.
    this.miniLevelIcon.innerHTML = levelIcon(LEVEL_BARS[game.level], 20);
    this.miniLevel.textContent = this.levelName(game.level);
    for (const {el, values} of this.tallies) {
      for (const key of ['you', 'cpu', 'draw'] as const) {
        values[key].textContent = this.format(game.tally[key]);
        values[key].classList.toggle('gain', ended && el.parentElement === this.result && game.result === key);
      }
    }

    // The board.
    const win = ended && game.line ? new Set(game.line.cells) : null;
    const ghost = aiming ? game.landingRow() * COLS + game.aim : -1;
    const marked = playing && !cpuTurn ? game.last : -1;
    for (let i = 0; i < CELLS; i++) {
      const cell = this.cells[i];
      const row = rowOf(i);
      const inAim = aiming && colOf(i) === game.aim;
      cell.className = inAim ? `cell aim${row === 0 ? ' top' : row === ROWS - 1 ? ' bottom' : ''}` : 'cell';
      const value: Disc = fall && fall.cell === i ? EMPTY : game.cells[i];
      let html: string;
      if (value === EMPTY) html = i === ghost ? '<div class="disc ghost"></div>' : '<div class="disc hole"></div>';
      else {
        const inWin = win?.has(i) ?? false;
        // The end: the four bright (filled ones with a halo), the rest dimmed; a draw dims all.
        const dim = ended ? (game.result === 'draw' ? 0.5 : inWin ? 0 : 0.3) : 0;
        const style = dim ? ` style="opacity: ${dim}"` : '';
        html = value === YOU ? `<div class="disc you${inWin ? ' win' : ''}"${style}></div>` : `<div class="disc cpu"${style}><i></i></div>`;
      }
      if (i === marked) html += brackets(PLAY.pitch);
      cell.innerHTML = html;
    }
    this.drawWinLine(win ? game.line!.cells : null);

    // Your disc over the aimed column.
    if (aiming) this.hover.style.left = `${columnX(game.aim) - DISC / 2}px`;

    // The open top bar.
    const focused = screen === 'bar' ? BAR[game.focus] : null;
    this.barButtons.forEach((button, i) => button.classList.toggle('is-focus', BAR[i] === focused));
    this.barLevelIcon.innerHTML = levelIcon(LEVEL_BARS[game.level], 22);
    this.levels(this.barLevels, game.level);
    const next = game.next === YOU ? s.barNextYou : s.barNextCpu;
    const barText = focused === 'new' ? fill(s.barNewText, {next}) : focused === 'level' ? s.barLevelText : s.barHowText;
    this.barHint.replaceChildren(...barText.split('\n').map((line) => text('span', '', line)));

    // The end screen.
    if (ended) {
      const level = this.levelName(game.level);
      this.resultTitle.textContent = game.result === 'you' ? s.youWin : game.result === 'cpu' ? s.cpuWins : s.drawTitle;
      const kind = game.line?.kind;
      const sub = game.result === 'draw' || !kind ? s.drawText : kind === 'across' ? s.fourAcross : kind === 'column' ? s.fourColumn : s.fourDiagonal;
      this.resultSub.textContent = fill(sub, {level});
      this.endNote.textContent = game.next === YOU ? s.youStart : s.cpuStarts;
      this.endLevelIcon.innerHTML = levelIcon(LEVEL_BARS[game.level], 26);
      this.levels(this.endLevels, game.level);
    }
    const rows = screen === 'newgame' ? this.newRows : ended ? this.endButtons : [];
    for (const button of [...this.newRows, ...this.endButtons]) button.classList.toggle('is-focus', rows[game.focus] === button);

    this.foot.textContent =
      screen === 'howto' ? s.howHint
        : screen === 'bar' ? (focused === 'new' ? s.barNewHint : focused === 'level' ? s.barLevelHint : s.barHowHint)
          : screen === 'newgame' ? s.listHint
            : ended ? s.endHint
              : cpuTurn ? s.cpuHint : s.playHint;
    this.focus();
  }

  /** The bright line over the four of an end screen. */
  private drawWinLine(cells: number[] | null): void {
    this.winLine.style.display = cells ? '' : 'none';
    if (!cells) return;
    const {left, top, pitch} = END;
    const width = COLS * pitch;
    const height = ROWS * pitch;
    const center = (cell: number) => [colOf(cell) * pitch + pitch / 2, rowOf(cell) * pitch + pitch / 2];
    const [x1, y1] = center(cells[0]);
    const [x2, y2] = center(cells[cells.length - 1]);
    Object.assign(this.winLine.style, {left: `${left + 12}px`, top: `${top + 12}px`});
    this.winLine.setAttribute('width', String(width));
    this.winLine.setAttribute('height', String(height));
    this.winLine.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.winLine.innerHTML =
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${UI.bg}" stroke-width="13" stroke-linecap="round"/>` +
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${UI.win}" stroke-width="5" stroke-linecap="round"/>`;
  }

  /** Puts the focus where the keys belong: the focused button or row, else the screen. Never nowhere. */
  focus(): void {
    const game = this.game;
    const screen = this.falling && game.screen === 'end' ? 'board' : game.screen;
    const target =
      screen === 'bar' ? this.barButtons[game.focus]
        : screen === 'newgame' ? this.newRows[game.focus]
          : screen === 'end' ? this.endButtons[game.focus]
            : screen === 'howto' ? this.howto : this.board;
    if (document.activeElement !== target) target.focus({preventScroll: true});
  }

  /**
   * Shows [drop]'s disc falling into its cell (yours from where it was held, the computer's from
   * the top row), then draws the state. Returns how long the fall takes, in ms.
   */
  drop(drop: Drop): number {
    this.flush();
    const row = rowOf(drop.cell);
    const from = drop.side === YOU ? HOVER_TOP : rowTop(0) - PLAY.pitch / 2;
    const to = rowTop(row);
    const ms = fallMs(to - from);
    const x = columnX(drop.col) - DISC / 2;
    this.falling = {drop, timer: window.setTimeout(() => this.land(), ms)};
    this.render();
    const fall = this.fall;
    fall.innerHTML =
      `<svg class="trail" width="${DISC}" height="60" viewBox="0 -60 ${DISC} 60" fill="none" stroke-width="3" stroke-linecap="round" aria-hidden="true">` +
      `${trail(DISC / 2, 0)}</svg>` +
      (drop.side === YOU ? '<div class="disc you big"></div>' : '<div class="disc cpu big falling"><i></i></div>');
    fall.style.transition = 'none';
    fall.style.transform = `translate(${x}px, ${from}px)`;
    fall.hidden = false;
    void fall.offsetWidth; // start the transition from there
    fall.style.transition = `transform ${ms}ms cubic-bezier(0.5, 0, 0.9, 0.6)`;
    fall.style.transform = `translate(${x}px, ${to}px)`;
    return ms;
  }

  /** Ends a fall still running: draws its end at once. */
  flush(): void {
    if (!this.falling) return;
    clearTimeout(this.falling.timer);
    this.land();
  }

  private land(): void {
    this.falling = null;
    this.fall.hidden = true;
    this.render();
  }
}
