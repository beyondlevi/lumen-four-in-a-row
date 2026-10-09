import {type Level, LEVELS} from './ai';
import {
  COLS, CPU, type Cells, EMPTY, type Line, type Side, YOU, canDrop, count, drop, emptyBoard, findLine, fromRows,
  isFull, lineThrough, other, rowOf, toRows,
} from './board';

/** Where the game is: the board, the open top bar, or a screen over the board. */
export type Screen = 'board' | 'bar' | 'newgame' | 'howto' | 'end';

/** The top bar's buttons, left to right. */
export type BarButton = 'new' | 'level' | 'howto';
export const BAR: readonly BarButton[] = ['new', 'level', 'howto'];

/** A row of a screen's list. */
export type RowId = 'start' | 'keep' | 'play' | 'level';

export type Result = 'you' | 'cpu' | 'draw';

export interface Tally {
  you: number;
  cpu: number;
  draw: number;
}

/** Where the game is kept: localStorage in the app, memory in the tests. */
export interface Store {
  load(): string | null;
  save(text: string): void;
}

/** What is kept between launches, as JSON under one key. */
export interface Saved {
  v: 1;
  /** 6 rows of 7: '.' empty, 'Y' yours, 'C' the computer's. */
  board: string[];
  turn: 'you' | 'cpu';
  /** Who starts the next game (it alternates). */
  next: 'you' | 'cpu';
  level: Level;
  tally: Tally;
  /** The column your disc is held over. */
  aim: number;
  /** The cell of the computer's last disc, or -1. */
  last: number;
  /** Whether the "Aim, then drop" card was seen (it shows until the very first drop). */
  firstSeen: boolean;
}

export const STORAGE_KEY = 'lumen-four-in-a-row';

/** A disc that went in: who, the column, and the cell it landed on. */
export interface Drop {
  side: Side;
  col: number;
  cell: number;
}

/** What a key did: [handled] means the game used it (for Escape: Lumen must not close the app). */
export interface KeyResult {
  handled: boolean;
  /** Set when the key dropped your disc. */
  drop?: Drop;
}

const sideName = (side: Side): 'you' | 'cpu' => (side === YOU ? 'you' : 'cpu');
const sideOf = (name: unknown): Side | null => (name === 'you' ? YOU : name === 'cpu' ? CPU : null);

export class Game {
  cells: Cells = emptyBoard();
  /** Whose disc goes in next. */
  turn: Side = YOU;
  /** Who starts the next game. */
  next: Side = CPU;
  level: Level = 'medium';
  tally: Tally = {you: 0, cpu: 0, draw: 0};
  /** The column your disc is held over. */
  aim = 3;
  /** The computer's last disc (the corner marks), or -1. */
  last = -1;
  result: Result | null = null;
  /** The four (or more) that ended the game. */
  line: Line | null = null;
  firstSeen = false;
  screen: Screen = 'board';
  /** The focused button of the top bar, or row of the screen's list. */
  focus = 0;

  constructor(private readonly store: Store) {
    if (!this.restore()) this.newGame(YOU);
  }

  /** Your turn, with the game on. */
  get yourTurn(): boolean {
    return this.turn === YOU && !this.result;
  }

  /** The computer's turn, with the game on: it thinks, then drops. */
  get thinking(): boolean {
    return this.turn === CPU && !this.result;
  }

  /** The "Aim, then drop" card: on the board, at your turn, until your very first drop. */
  get firstCard(): boolean {
    return !this.firstSeen && this.screen === 'board' && this.yourTurn;
  }

  /** A game with discs in, not over: New game asks before ending it. */
  get inProgress(): boolean {
    return !this.result && this.cells.some((disc) => disc !== EMPTY);
  }

  /** Who started this game: with as many discs each, the side to move; else the one with more. */
  get starter(): Side {
    const you = count(this.cells, YOU);
    const cpu = count(this.cells, CPU);
    if (you === cpu) return this.turn;
    return you > cpu ? YOU : CPU;
  }

  /** The list of the current screen. */
  rows(): RowId[] {
    switch (this.screen) {
      case 'newgame': return ['start', 'keep'];
      case 'end': return ['play', 'level'];
      default: return [];
    }
  }

  /** A new game: the board empty, [first] (or whoever's next) to start, then the other next time. */
  newGame(first: Side = this.next): void {
    this.cells = emptyBoard();
    this.turn = first;
    this.next = other(first);
    this.last = -1;
    this.result = null;
    this.line = null;
    this.aim = 3;
    this.show('board');
    this.save();
  }

  /** Drops your disc in the aimed column. Null when it isn't your turn or the column is full. */
  dropYours(): Drop | null {
    if (!this.yourTurn) return null;
    const done = drop(this.cells, this.aim, YOU);
    if (!done) return null;
    this.firstSeen = true;
    return this.play(YOU, this.aim, done);
  }

  /** The computer's disc in [col]. Null when it isn't its turn or the column is full. */
  cpuDrop(col: number): Drop | null {
    if (!this.thinking) return null;
    const done = drop(this.cells, col, CPU);
    if (!done) return null;
    this.last = done.cell;
    return this.play(CPU, col, done);
  }

  private play(side: Side, col: number, done: {cells: Cells; cell: number}): Drop {
    this.cells = done.cells;
    // The turn passes even when the game ends: the discs and whose turn it is always agree.
    this.turn = other(side);
    this.line = lineThrough(this.cells, done.cell);
    if (this.line) this.end(sideName(side));
    else if (isFull(this.cells)) this.end('draw');
    if (!canDrop(this.cells, this.aim)) this.aim = this.nearestOpen(this.aim);
    this.save();
    return {side, col, cell: done.cell};
  }

  private end(result: Result): void {
    this.result = result;
    this.tally[result]++;
    // The end screen comes up from the board or the bar; from How to play or New game? it waits.
    if (this.screen === 'board' || this.screen === 'bar') this.show('end');
  }

  /** Easy, then Medium, then Hard, then Easy again. It applies from the computer's next move. */
  cycleLevel(): void {
    this.level = LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length];
    this.save();
  }

  /** The band's keys: arrows, Enter (index tap) and Escape (middle tap, Lumen's Back). */
  key(key: string): KeyResult {
    const arrow = key.startsWith('Arrow');
    switch (this.screen) {
      case 'board':
        if (key === 'ArrowUp') {
          this.show('bar', 'level');
          return {handled: true};
        }
        // Escape: Lumen closes the app. The game is already saved.
        if (key === 'Escape') return {handled: false};
        if (!this.yourTurn) return {handled: arrow || key === 'Enter'};
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          this.moveAim(key === 'ArrowLeft' ? -1 : 1);
          return {handled: true};
        }
        if (key === 'ArrowDown' || key === 'Enter') return {handled: true, drop: this.dropYours() ?? undefined};
        return {handled: false};

      case 'bar':
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          this.focus = Math.max(0, Math.min(BAR.length - 1, this.focus + (key === 'ArrowLeft' ? -1 : 1)));
          return {handled: true};
        }
        if (key === 'ArrowDown' || key === 'Escape') {
          this.show(this.settled());
          return {handled: true};
        }
        if (key === 'Enter') {
          this.pressBar(BAR[this.focus]);
          return {handled: true};
        }
        return {handled: arrow};

      case 'howto':
        if (key === 'Enter' || key === 'Escape') {
          this.show('bar', 'howto');
          return {handled: true};
        }
        return {handled: arrow};

      case 'newgame':
      case 'end':
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          const last = this.rows().length - 1;
          this.focus = Math.max(0, Math.min(last, this.focus + (key === 'ArrowUp' ? -1 : 1)));
          return {handled: true};
        }
        if (key === 'Enter') {
          this.activate(this.focus);
          return {handled: true};
        }
        if (key === 'Escape') {
          // New game?: back to the bar. The end screens: Lumen closes the app (the tally is saved).
          if (this.screen === 'newgame') {
            this.show('bar', 'new');
            return {handled: true};
          }
          return {handled: false};
        }
        return {handled: arrow};
    }
  }

  /** Runs a button of the top bar. */
  pressBar(button: BarButton): void {
    this.focus = BAR.indexOf(button);
    if (button === 'level') this.cycleLevel();
    else if (button === 'howto') this.show('howto');
    else if (this.inProgress) this.show('newgame');
    else this.newGame();
  }

  /** Runs the row at [index] of the current screen's list. */
  activate(index: number): void {
    switch (`${this.screen}:${this.rows()[index]}`) {
      case 'newgame:start':
      case 'end:play':
        // An abandoned game doesn't count in the tally.
        this.newGame();
        break;
      case 'newgame:keep':
        this.show(this.settled());
        break;
      case 'end:level':
        this.focus = index;
        this.cycleLevel();
        break;
    }
  }

  /**
   * Puts the board in a given state (the e2e test hook), with [turn] to play, then shows what
   * follows from it. False when the board isn't one a game can reach.
   */
  set(rows: string[], turn: 'you' | 'cpu', options: {last?: [number, number]; tally?: Tally; aim?: number} = {}): boolean {
    const cells = fromRows(rows);
    const side = sideOf(turn);
    if (!cells || !side) return false;
    this.cells = cells;
    this.turn = side;
    this.next = other(this.starter);
    this.line = null;
    this.result = this.resultOf();
    const last = options.last ? options.last[0] * COLS + options.last[1] : -1;
    this.last = cells[last] === CPU ? last : -1;
    if (options.tally) this.tally = {...options.tally};
    this.aim = this.nearestOpen(options.aim ?? this.aim);
    this.firstSeen = true;
    this.show(this.settled());
    this.save();
    return true;
  }

  /** The result a board shows (a four, or a full board), with its line. */
  private resultOf(): Result | null {
    for (const side of [YOU, CPU] as const) {
      const line = findLine(this.cells, side);
      if (line) {
        this.line = line;
        return sideName(side);
      }
    }
    return isFull(this.cells) ? 'draw' : null;
  }

  /** The screen a game leads to: the end screen once it's over, else the board. */
  private settled(): Screen {
    return this.result ? 'end' : 'board';
  }

  /** Shows [screen] with the focus on [on] (a bar button or a row), else on its first one. */
  private show(screen: Screen, on?: BarButton | RowId): void {
    this.screen = screen;
    if (screen === 'bar') this.focus = Math.max(0, BAR.indexOf(on as BarButton));
    else this.focus = Math.max(0, this.rows().indexOf(on as RowId));
  }

  /** Moves your disc to the next column that takes one, left or right; it stops at the ends. */
  private moveAim(step: number): void {
    for (let col = this.aim + step; col >= 0 && col < COLS; col += step) {
      if (canDrop(this.cells, col)) {
        this.aim = col;
        this.save();
        return;
      }
    }
  }

  /** [col] if it takes a disc, else the closest column that does (right first). */
  private nearestOpen(col: number): number {
    const start = Number.isInteger(col) ? Math.max(0, Math.min(COLS - 1, col)) : 3;
    for (let d = 0; d < COLS; d++) {
      for (const c of [start + d, start - d]) {
        if (c >= 0 && c < COLS && canDrop(this.cells, c)) return c;
      }
    }
    return start;
  }

  save(): void {
    const saved: Saved = {
      v: 1,
      board: toRows(this.cells),
      turn: sideName(this.turn),
      next: sideName(this.next),
      level: this.level,
      tally: {...this.tally},
      aim: this.aim,
      last: this.last,
      firstSeen: this.firstSeen,
    };
    this.store.save(JSON.stringify(saved));
  }

  /** Loads the saved game. False when there is none or it is broken: then a new game starts. */
  private restore(): boolean {
    let data: Partial<Saved> | null;
    try {
      data = JSON.parse(this.store.load() ?? 'null') as Partial<Saved> | null;
    } catch {
      return false;
    }
    if (!data || typeof data !== 'object') return false;
    // The tally and the settings are worth keeping even when the board isn't.
    if (LEVELS.includes(data.level as Level)) this.level = data.level as Level;
    const tally = data.tally;
    if (tally && typeof tally === 'object' && isCount(tally.you) && isCount(tally.cpu) && isCount(tally.draw)) {
      this.tally = {you: tally.you, cpu: tally.cpu, draw: tally.draw};
    }
    this.firstSeen = data.firstSeen === true;
    const next = sideOf(data.next);
    if (next) this.next = next;

    const cells = fromRows(data.board);
    const turn = sideOf(data.turn);
    if (!cells || !turn) return false;
    // The discs must match whose turn it is: as many each, or one more for the side that just played.
    const lead = count(cells, YOU) - count(cells, CPU);
    if (Math.abs(lead) > 1 || (lead === 1 && turn === YOU) || (lead === -1 && turn === CPU)) return false;
    this.cells = cells;
    this.turn = turn;
    this.line = null;
    this.result = this.resultOf();
    const last = data.last;
    this.last = Number.isInteger(last) && cells[last as number] === CPU ? last as number : -1;
    this.aim = this.nearestOpen(Number.isInteger(data.aim) ? data.aim as number : 3);
    this.show(this.settled());
    return true;
  }

  /** For the tests and the test hook. */
  rowsOfCells(): string[] {
    return toRows(this.cells);
  }

  /** The row the aimed column's disc lands on (the ghost), or -1. */
  landingRow(): number {
    const done = drop(this.cells, this.aim, YOU);
    return done ? rowOf(done.cell) : -1;
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1e9;
}
