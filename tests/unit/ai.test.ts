import {describe, expect, it} from 'vitest';
import {EASY_BLOCKS, HARD_BUDGET_MS, type Level, chooseMove} from '../../src/ai';
import {CPU, type Cells, type Side, YOU, drop, emptyBoard, fromRows, isFull, lineThrough, other} from '../../src/board';
import {Rng} from '../../src/rng';

const board = (rows: string[]): Cells => fromRows(rows)!;
const think = (rows: string[], level: Level, seed = 1, budgetMs = 200) => chooseMove(board(rows), CPU, level, {rng: new Rng(seed), budgetMs});

// The computer to move. It wins in column 3; you'd win in column 4 next.
const CAN_WIN = ['.......', '.......', '.......', '....Y..', '....Y..', 'CCC.YY.'];
// You'd win in column 4 next; the computer has no win: it must block.
const MUST_BLOCK = ['.......', '.......', '.......', '.......', '.......', 'CYYY..C'];
// Column 4 makes three with both ends open: a win two moves later, whatever you do.
const WIN_IN_TWO = ['.......', '.......', '.......', '.......', '.......', 'Y.CC..Y'];
// Column 3 under your three on row 4: playing it lets you win on top.
const TRAP = ['.......', '.......', '.......', '.......', 'YYY...C', 'CCY...C'];
// A middle game with many moves to search: the design's, after you blocked its diagonal.
const MID = ['.......', '.......', '....Y..', '..YCC..', '..CYY..', 'YCYYCC.'];

describe('the computer', () => {
  it('takes a win at Medium and Hard, before blocking yours', () => {
    for (let seed = 1; seed <= 5; seed++) {
      expect(think(CAN_WIN, 'medium', seed).col).toBe(3);
      expect(think(CAN_WIN, 'hard', seed).col).toBe(3);
    }
  });

  it('blocks a four you could make next at Medium and Hard', () => {
    for (let seed = 1; seed <= 5; seed++) {
      expect(think(MUST_BLOCK, 'medium', seed).col).toBe(4);
      expect(think(MUST_BLOCK, 'hard', seed).col).toBe(4);
    }
    // A diagonal threat, too: you'd make four at row 2 of column 3.
    const diagonal = ['.......', '.......', '.......', '..YC...', '.YCY...', 'YCYC...'];
    expect(lineThrough(drop(board(diagonal), 3, YOU)!.cells, 17)).not.toBeNull();
    expect(think(diagonal, 'medium').col).toBe(3);
    expect(think(diagonal, 'hard').col).toBe(3);
  });

  it('sees a win two moves ahead at Hard', () => {
    for (let seed = 1; seed <= 3; seed++) expect(think(WIN_IN_TWO, 'hard', seed).col).toBe(4);
  });

  it('never plays right under your four at Medium and Hard', () => {
    // You'd make four across row 4 in column 3 once a disc is under it: column 3 is the trap.
    for (let seed = 1; seed <= 3; seed++) {
      expect(think(TRAP, 'medium', seed).col).not.toBe(3);
      expect(think(TRAP, 'hard', seed).col).not.toBe(3);
    }
  });

  it('is beatable at Easy: it blocks only sometimes, and never plays under your four', () => {
    let blocked = 0;
    const runs = 400;
    for (let seed = 1; seed <= runs; seed++) {
      if (think(MUST_BLOCK, 'easy', seed).col === 4) blocked++;
    }
    // About EASY_BLOCKS of the time, plus the random moves that land on column 4.
    expect(blocked / runs).toBeGreaterThan(EASY_BLOCKS - 0.1);
    expect(blocked / runs).toBeLessThan(EASY_BLOCKS + 0.2);
    for (let seed = 1; seed <= 100; seed++) expect(think(TRAP, 'easy', seed).col).not.toBe(3);
  });

  it('keeps Hard within its time budget, also on the open board', () => {
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(600);
    for (const rows of [['.......', '.......', '.......', '.......', '.......', '.......'], MID]) {
      const start = performance.now();
      const thought = chooseMove(board(rows), CPU, 'hard', {rng: new Rng(3)});
      const ms = performance.now() - start;
      expect(ms).toBeLessThan(HARD_BUDGET_MS + 50);
      expect(thought.depth).toBeGreaterThanOrEqual(6);
    }
  });

  it('stops Hard at its deadline even when the clock jumps', () => {
    let clock = 0;
    const thought = chooseMove(board(MID), CPU, 'hard', {rng: new Rng(1), budgetMs: 100, now: () => (clock += 0.5)});
    expect(thought.depth).toBeGreaterThanOrEqual(1);
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(thought.col);
  });

  it('plays Hard well enough to beat Easy', () => {
    let hardWins = 0;
    let easyWins = 0;
    const games = 6;
    for (let game = 0; game < games; game++) {
      const rng = new Rng(100 + game);
      const hard: Side = game % 2 === 0 ? CPU : YOU; // who starts alternates
      let cells = emptyBoard();
      let side: Side = game % 2 === 0 ? YOU : CPU;
      for (;;) {
        const level: Level = side === hard ? 'hard' : 'easy';
        const {col} = chooseMove(cells, side, level, {rng, budgetMs: 60});
        const done = drop(cells, col, side)!;
        expect(done).not.toBeNull();
        cells = done.cells;
        if (lineThrough(cells, done.cell)) {
          if (side === hard) hardWins++;
          else easyWins++;
          break;
        }
        if (isFull(cells)) break;
        side = other(side);
      }
    }
    expect(easyWins).toBe(0);
    expect(hardWins).toBeGreaterThanOrEqual(games - 1);
  });
});
