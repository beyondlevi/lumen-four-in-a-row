/**
 * The computer: an alpha-beta (negamax) search over the 7 x 6 board.
 *
 * - Easy takes a winning move or blocks yours only sometimes, else plays at random among the
 *   moves that don't hand you a win on top of them: beatable.
 * - Medium searches 4 plies.
 * - Hard deepens one ply at a time (center columns first, the best move of the last depth first,
 *   a transposition table) until its time budget runs out, then plays the best move of the
 *   deepest search it finished.
 *
 * Medium and Hard always take a win and always block a four you could make next.
 */
import {CELLS, COLS, CPU, type Cells, ROWS, type Side, YOU, cellOf, count, other} from './board';
import {Rng} from './rng';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

/** Hard's search time per move, in ms (the glasses' CPU is slow: this keeps the turn short). */
export const HARD_BUDGET_MS = 600;
export const MEDIUM_DEPTH = 4;
/** How often Easy takes a win it has, and blocks one of yours. */
export const EASY_TAKES_WIN = 0.7;
export const EASY_BLOCKS = 0.5;

/** Center columns first: they take part in the most lines of four. */
const ORDER = [3, 2, 4, 1, 5, 0, 6];
/** A win at the n-th disc of the game scores WIN - n: the sooner, the better. */
const WIN = 1_000_000;
const MATE = WIN - CELLS - 1;
/** What one, two or three discs alone in a line of four are worth. */
const WEIGHT = [0, 1, 5, 25];
/** A three whose missing cell is on a row that suits its owner (odd rows from the bottom for the
 * side that started, even rows for the other) usually wins at the end; others, less often. */
const GOOD_THREAT = 20;
const OTHER_THREAT = 5;
const CENTER = 4;

// The position is column-major, bottom up: index = col * 6 + height.
const at = (col: number, height: number) => col * ROWS + height;

/** Every line of four on the board, as 4 indexes each (69 lines). */
const WINDOWS: Int8Array = (() => {
  const list: number[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let h = 0; h < ROWS; h++) {
      for (const [dc, dh] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const ec = c + 3 * dc;
        const eh = h + 3 * dh;
        if (ec < 0 || ec >= COLS || eh < 0 || eh >= ROWS) continue;
        for (let i = 0; i < 4; i++) list.push(at(c + i * dc, h + i * dh));
      }
    }
  }
  return Int8Array.from(list);
})();

/** One bit per cell in a 7-bit field per column: mask + your discs is a unique key (< 2^49). */
const BITS: number[] = Array.from({length: CELLS}, (_, i) => 2 ** (Math.floor(i / ROWS) * 7 + (i % ROWS)));

class Position {
  readonly grid = new Int8Array(CELLS);
  readonly heights = new Int8Array(COLS);
  moves = 0;
  mask = 0;
  mine = 0;

  constructor(cells: Cells, readonly first: Side) {
    for (let col = 0; col < COLS; col++) {
      for (let row = ROWS - 1; row >= 0; row--) {
        const disc = cells[cellOf(row, col)];
        if (!disc) break;
        this.play(col, disc);
      }
    }
  }

  canPlay(col: number): boolean {
    return this.heights[col] < ROWS;
  }

  play(col: number, side: Side): void {
    const i = at(col, this.heights[col]++);
    this.grid[i] = side;
    this.moves++;
    this.mask += BITS[i];
    if (side === YOU) this.mine += BITS[i];
  }

  undo(col: number): void {
    const i = at(col, --this.heights[col]);
    if (this.grid[i] === YOU) this.mine -= BITS[i];
    this.mask -= BITS[i];
    this.grid[i] = 0;
    this.moves--;
  }

  key(): number {
    return this.mask + this.mine;
  }

  /** Whether [side] makes four by dropping a disc in [col] now (the column must take one). */
  winsAt(col: number, side: Side): boolean {
    return this.fourAt(col, this.heights[col], side);
  }

  /** Whether a disc of [side] at (col, height) would make four with the discs already there. */
  fourAt(col: number, height: number, side: Side): boolean {
    const g = this.grid;
    if (height >= 3 && g[at(col, height - 1)] === side && g[at(col, height - 2)] === side && g[at(col, height - 3)] === side) return true;
    for (let d = 0; d < 3; d++) {
      const dh = d - 1; // across (0), and the two diagonals (-1, 1)
      let n = 0;
      for (let c = col + 1, h = height + dh; c < COLS && h >= 0 && h < ROWS && g[at(c, h)] === side; c++, h += dh) n++;
      for (let c = col - 1, h = height - dh; c >= 0 && h >= 0 && h < ROWS && g[at(c, h)] === side; c--, h -= dh) n++;
      if (n >= 3) return true;
    }
    return false;
  }

  /** The board's worth for [side]: its open lines minus the other side's. */
  evaluate(side: Side): number {
    const g = this.grid;
    let score = 0;
    for (let w = 0; w < WINDOWS.length; w += 4) {
      let you = 0;
      let cpu = 0;
      let hole = -1;
      for (let k = 0; k < 4; k++) {
        const i = WINDOWS[w + k];
        const disc = g[i];
        if (disc === YOU) you++;
        else if (disc === CPU) cpu++;
        else hole = i;
      }
      if (you && cpu) continue;
      if (you) score += WEIGHT[you] + (you === 3 ? this.threat(hole, YOU) : 0);
      else if (cpu) score -= WEIGHT[cpu] + (cpu === 3 ? this.threat(hole, CPU) : 0);
    }
    for (let h = 0; h < ROWS; h++) {
      const disc = g[at(3, h)];
      if (disc === YOU) score += CENTER;
      else if (disc === CPU) score -= CENTER;
    }
    return side === YOU ? score : -score;
  }

  /** The extra worth of [side]'s three missing the cell [hole], by the row it waits on. */
  private threat(hole: number, side: Side): number {
    const col = Math.floor(hole / ROWS);
    const height = hole % ROWS;
    if (height === this.heights[col]) return 0; // playable now: the search sees it
    const oddRow = height % 2 === 0; // rows counted from 1 at the bottom
    return oddRow === (side === this.first) ? GOOD_THREAT : OTHER_THREAT;
  }
}

class Timeout extends Error {}

// Transposition table entries, packed in one number: value, depth, bound and best move.
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const OFFSET = 2 ** 21;
const pack = (value: number, depth: number, bound: number, move: number) => ((value + OFFSET) * 64 + depth) * 32 + bound * 8 + move;

/** Table sizes, primes: about 2^18 entries for Hard (4 MB with the keys), a small one for Medium. */
const HARD_TABLE = 262147;
const MEDIUM_TABLE = 4099;

class Search {
  nodes = 0;
  // The transposition table: the key of the position each slot holds, and its packed entry.
  private readonly keys: Float64Array;
  private readonly entries: Float64Array;

  constructor(readonly pos: Position, private readonly deadline: number, private readonly now: () => number, private readonly size: number) {
    this.keys = new Float64Array(size).fill(-1);
    this.entries = new Float64Array(size);
  }

  /** The score of the position for [side], to move, searched [depth] plies deep. */
  negamax(depth: number, alpha: number, beta: number, side: Side): number {
    const pos = this.pos;
    if ((++this.nodes & 1023) === 0 && this.now() > this.deadline) throw new Timeout();
    if (pos.moves === CELLS) return 0;
    for (let col = 0; col < COLS; col++) {
      if (pos.canPlay(col) && pos.winsAt(col, side)) return WIN - (pos.moves + 1);
    }
    const foe = other(side);
    let forced = -1;
    for (let col = 0; col < COLS; col++) {
      if (pos.canPlay(col) && pos.winsAt(col, foe)) {
        if (forced >= 0) return -(WIN - (pos.moves + 2)); // two threats: one of them wins
        forced = col;
      }
    }
    // A forced block costs no depth: the line it starts is narrow.
    if (forced < 0 && depth <= 0) return pos.evaluate(side);

    const key = pos.key();
    const slot = key % this.size;
    let hint = -1;
    if (this.keys[slot] === key) {
      const entry = this.entries[slot];
      hint = entry % 8;
      const bound = Math.floor(entry / 8) % 4;
      const stored = Math.floor(entry / 32);
      const entryDepth = stored % 64;
      const value = Math.floor(stored / 64) - OFFSET;
      if (entryDepth >= depth) {
        if (bound === EXACT) return value;
        if (bound === LOWER && value > alpha) alpha = value;
        else if (bound === UPPER && value < beta) beta = value;
        if (alpha >= beta) return value;
      }
    }

    const start = alpha;
    let best = -Infinity;
    let bestMove = -1;
    const next = forced >= 0 ? depth : depth - 1;
    for (let k = -1; k < COLS; k++) {
      const col = forced >= 0 ? (k === -1 ? forced : -1) : k === -1 ? hint : ORDER[k];
      if (col < 0 || (k >= 0 && col === hint) || !pos.canPlay(col)) continue;
      pos.play(col, side);
      const value = -this.negamax(next, -beta, -alpha, foe);
      pos.undo(col);
      if (value > best) {
        best = value;
        bestMove = col;
      }
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    const bound = best <= start ? UPPER : best >= beta ? LOWER : EXACT;
    this.keys[slot] = key;
    this.entries[slot] = pack(best, Math.max(0, depth), bound, bestMove);
    return best;
  }

  /** Each root move's score, [depth] plies deep. Moves tied with the best get their exact score. */
  root(depth: number, side: Side, moves: number[]): Map<number, number> {
    const scores = new Map<number, number>();
    let best = -Infinity;
    for (const col of moves) {
      this.pos.play(col, side);
      const value = -this.negamax(depth - 1, -WIN - 1, -(best === -Infinity ? -WIN - 1 : best - 1), other(side));
      this.pos.undo(col);
      scores.set(col, value);
      if (value > best) best = value;
    }
    return scores;
  }
}

export interface ThinkOptions {
  rng: Rng;
  /** Hard's search time, in ms (default HARD_BUDGET_MS). */
  budgetMs?: number;
  now?: () => number;
}

export interface Thought {
  col: number;
  /** The depth of the search the move comes from (0: no search). */
  depth: number;
  nodes: number;
}

/** The side that dropped the first disc of the game, from the discs on [cells] and [toMove]. */
function firstOf(cells: Cells, toMove: Side): Side {
  const you = count(cells, YOU);
  const cpu = count(cells, CPU);
  if (you === cpu) return toMove;
  return you > cpu ? YOU : CPU;
}

/** The column [side] plays on [cells] at [level]. The board must have an open column. */
export function chooseMove(cells: Cells, side: Side, level: Level, options: ThinkOptions): Thought {
  const {rng} = options;
  const now = options.now ?? (() => performance.now());
  const pos = new Position(cells, firstOf(cells, side));
  const foe = other(side);
  const moves = ORDER.filter((col) => pos.canPlay(col));
  if (!moves.length) throw new Error('the board is full');
  const pick = (cols: number[]) => cols[rng.int(cols.length)];
  const wins = moves.filter((col) => pos.winsAt(col, side));
  const blocks = moves.filter((col) => pos.winsAt(col, foe));

  if (level === 'easy') {
    if (wins.length && rng.chance(EASY_TAKES_WIN)) return {col: wins[0], depth: 0, nodes: 0};
    if (blocks.length && rng.chance(EASY_BLOCKS)) return {col: blocks[0], depth: 0, nodes: 0};
    // Not right under one of your wins.
    const safe = moves.filter((col) => {
      const height = pos.heights[col];
      return height + 1 >= ROWS || !pos.fourAt(col, height + 1, foe);
    });
    return {col: pick(safe.length ? safe : moves), depth: 0, nodes: 0};
  }

  if (wins.length) return {col: wins[0], depth: 0, nodes: 0};
  if (blocks.length) return {col: blocks[0], depth: 0, nodes: 0};
  if (moves.length === 1) return {col: moves[0], depth: 0, nodes: 0};

  const begin = now();
  const budget = options.budgetMs ?? HARD_BUDGET_MS;
  const hard = level === 'hard';
  const search = new Search(pos, hard ? begin + budget : Infinity, now, hard ? HARD_TABLE : MEDIUM_TABLE);
  const bestOf = (scores: Map<number, number>) => {
    const top = Math.max(...scores.values());
    return {top, cols: [...scores].filter(([, v]) => v === top).map(([col]) => col)};
  };

  if (level === 'medium') {
    const {cols} = bestOf(search.root(MEDIUM_DEPTH, side, moves));
    return {col: pick(cols), depth: MEDIUM_DEPTH, nodes: search.nodes};
  }

  // Hard: one ply deeper at a time, while the budget lasts.
  let order = moves;
  let choice = moves[0];
  let depth = 0;
  for (let d = 1; d <= CELLS - pos.moves; d++) {
    let scores: Map<number, number>;
    try {
      scores = search.root(d, side, order);
    } catch (error) {
      if (error instanceof Timeout) break;
      throw error;
    }
    depth = d;
    const {top, cols} = bestOf(scores);
    choice = cols.length > 1 ? pick(cols) : cols[0];
    // The best moves first next time; equal scores keep the center-first order.
    order = [...order].sort((a, b) => scores.get(b)! - scores.get(a)!);
    // A forced result (a win, or a loss whatever happens) needs no deeper search.
    if (top >= MATE || top <= -MATE) break;
    // The next depth costs several times this one: don't start what can't finish.
    if (now() - begin > budget * 0.4) break;
  }
  return {col: choice, depth, nodes: search.nodes};
}
