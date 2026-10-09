import {describe, expect, it} from 'vitest';
import {CPU, YOU} from '../../src/board';
import {Game, STORAGE_KEY, type Store} from '../../src/game';

function memoryStore(text: string | null = null): Store & {text: string | null} {
  const store = {
    text,
    load: () => store.text,
    save: (t: string) => { store.text = t; },
  };
  return store;
}

const EMPTY = ['.......', '.......', '.......', '.......', '.......', '.......'];
// Your turn: column 3 makes four on the diagonal (the design's win, one disc short).
const WIN_NEXT = ['.......', '.......', '.......', '..YCY..', '.YCYC..', 'YCCYYCC'];
// The computer's turn: column 4 makes its four on the diagonal (the design's loss).
const LOSS_NEXT = ['.......', '.......', '...Y...', '..YCC..', '..CYY..', 'YCYYCC.'];
// Your turn, one cell left (column 1): it fills the board with no four (the design's draw).
const DRAW_NEXT = ['C.CYCYC', 'YCYYYCY', 'YYYCCYC', 'CCCYCCC', 'YCYCYYY', 'YCCYYCC'];
// The design's middle game, your turn.
const MID = ['.......', '.......', '.......', '..YCC..', '..CYY..', 'YCYYCC.'];

describe('a new game', () => {
  it('starts empty, with you first, the card on, the level Medium', () => {
    const game = new Game(memoryStore());
    expect(game.rowsOfCells()).toEqual(EMPTY);
    expect(game.turn).toBe(YOU);
    expect(game.next).toBe(CPU);
    expect(game.screen).toBe('board');
    expect(game.firstCard).toBe(true);
    expect(game.level).toBe('medium');
    expect(game.tally).toEqual({you: 0, cpu: 0, draw: 0});
    expect(game.aim).toBe(3);
  });

  it('alternates who starts, also after a game started over', () => {
    const game = new Game(memoryStore());
    const starters = [game.starter];
    game.newGame();
    starters.push(game.starter);
    expect(game.thinking).toBe(true); // the computer's game: its turn first
    game.newGame();
    starters.push(game.starter);
    game.set(WIN_NEXT, 'you');
    game.key('ArrowDown'); // win
    expect(game.screen).toBe('end');
    const next = game.next;
    game.key('Enter'); // Play again
    starters.push(game.starter);
    expect(game.starter).toBe(next);
    expect(starters).toEqual([YOU, CPU, YOU, CPU]);
  });
});

describe('aiming and dropping', () => {
  it('moves your disc over the columns and stops at the edges', () => {
    const game = new Game(memoryStore());
    game.key('ArrowLeft');
    expect(game.aim).toBe(2);
    for (let i = 0; i < 5; i++) game.key('ArrowLeft');
    expect(game.aim).toBe(0);
    for (let i = 0; i < 9; i++) game.key('ArrowRight');
    expect(game.aim).toBe(6);
  });

  it('skips full columns, and leaves one that fills up', () => {
    const game = new Game(memoryStore());
    game.set(['..Y....', '..C....', '..Y....', '..C....', '..Y....', '..C....'], 'you', {aim: 1});
    game.key('ArrowRight');
    expect(game.aim).toBe(3);
    game.key('ArrowLeft');
    expect(game.aim).toBe(1);
    // Column 3 fills with the next disc: the aim moves to the closest open column.
    game.set(['.......', '...C...', '...Y...', '...C...', '...Y...', '..YCC..'], 'you', {aim: 3});
    game.key('ArrowDown');
    expect(game.cells[3]).toBe(YOU);
    expect(game.aim).toBe(4);
  });

  it('drops with a swipe down or an index tap, then it is the computer turn', () => {
    const store = memoryStore();
    const game = new Game(store);
    const result = game.key('ArrowDown');
    expect(result.handled).toBe(true);
    expect(result.drop).toEqual({side: YOU, col: 3, cell: 38});
    expect(game.rowsOfCells()[5]).toBe('...Y...');
    expect(game.turn).toBe(CPU);
    expect(game.thinking).toBe(true);
    expect(game.firstCard).toBe(false);
    expect(JSON.parse(store.text!).firstSeen).toBe(true);
    // Not your turn: the keys do nothing but ArrowUp (the top bar) and Escape (exit).
    expect(game.key('Enter')).toEqual({handled: true});
    expect(game.key('ArrowLeft')).toEqual({handled: true});
    expect(game.aim).toBe(3);
    expect(game.key('Escape').handled).toBe(false);
    expect(game.dropYours()).toBeNull();
    // The computer's disc.
    const cpu = game.cpuDrop(3)!;
    expect(cpu.cell).toBe(31);
    expect(game.last).toBe(31);
    expect(game.turn).toBe(YOU);
    expect(game.cpuDrop(2)).toBeNull(); // not its turn
    expect(game.key('Enter').drop?.cell).toBe(24);
  });

  it('refuses illegal moves: a full column, a column off the board', () => {
    const game = new Game(memoryStore());
    game.set(['...C...', '...Y...', '...C...', '...Y...', '...C...', '..YYC..'], 'cpu');
    expect(game.cpuDrop(3)).toBeNull();
    expect(game.cpuDrop(7)).toBeNull();
    expect(game.cpuDrop(-1)).toBeNull();
    expect(game.turn).toBe(CPU);
    expect(game.cpuDrop(0)).not.toBeNull();
  });

  it('leaves Escape to Lumen on the board, where the game is already saved', () => {
    const store = memoryStore();
    const game = new Game(store);
    game.key('ArrowRight');
    expect(game.key('Escape').handled).toBe(false);
    expect(JSON.parse(store.text!)).toMatchObject({board: EMPTY, aim: 4});
  });
});

describe('the end of a game', () => {
  it('you win: the tally counts it, Play again comes focused, then the level', () => {
    const game = new Game(memoryStore());
    game.set(WIN_NEXT, 'you', {aim: 3, tally: {you: 3, cpu: 1, draw: 0}});
    game.key('Enter');
    expect(game.result).toBe('you');
    expect(game.line).toEqual({kind: 'diagonal', cells: [17, 23, 29, 35]});
    expect(game.tally).toEqual({you: 4, cpu: 1, draw: 0});
    expect(game.screen).toBe('end');
    expect(game.rows()).toEqual(['play', 'level']);
    expect(game.focus).toBe(0);
    // Back on an end screen exits the app.
    expect(game.key('Escape').handled).toBe(false);
    game.key('ArrowDown');
    expect(game.rows()[game.focus]).toBe('level');
    game.key('Enter');
    expect(game.level).toBe('hard');
    game.key('Enter');
    expect(game.level).toBe('easy');
    game.key('ArrowDown');
    expect(game.rows()[game.focus]).toBe('level');
    game.key('ArrowUp');
    game.key('Enter');
    expect(game.screen).toBe('board');
    expect(game.rowsOfCells()).toEqual(EMPTY);
    expect(game.tally).toEqual({you: 4, cpu: 1, draw: 0});
  });

  it('the computer wins', () => {
    const game = new Game(memoryStore());
    game.set(LOSS_NEXT, 'cpu');
    game.cpuDrop(4);
    expect(game.result).toBe('cpu');
    expect(game.line?.cells).toEqual([18, 24, 30, 36]);
    expect(game.tally).toEqual({you: 0, cpu: 1, draw: 0});
    expect(game.screen).toBe('end');
  });

  it('a full board with no four is a draw', () => {
    const game = new Game(memoryStore());
    game.set(DRAW_NEXT, 'you', {aim: 0});
    expect(game.aim).toBe(1);
    game.key('ArrowDown');
    expect(game.result).toBe('draw');
    expect(game.line).toBeNull();
    expect(game.tally).toEqual({you: 0, cpu: 0, draw: 1});
    expect(game.screen).toBe('end');
  });

  it('waits behind How to play and New game?, then shows', () => {
    const game = new Game(memoryStore());
    game.set(LOSS_NEXT, 'cpu');
    game.key('ArrowUp');
    game.key('ArrowRight');
    game.key('Enter');
    expect(game.screen).toBe('howto');
    game.cpuDrop(4);
    expect(game.screen).toBe('howto');
    expect(game.tally.cpu).toBe(1);
    game.key('Escape');
    expect(game.screen).toBe('bar');
    game.key('ArrowDown');
    expect(game.screen).toBe('end');
    // From the top bar it comes at once.
    const other = new Game(memoryStore());
    other.set(LOSS_NEXT, 'cpu');
    other.key('ArrowUp');
    other.cpuDrop(4);
    expect(other.screen).toBe('end');
  });
});

describe('the top bar', () => {
  it('opens on Level with a swipe up; left and right move, down and Back close it', () => {
    const game = new Game(memoryStore());
    expect(game.key('ArrowUp').handled).toBe(true);
    expect(game.screen).toBe('bar');
    expect(game.focus).toBe(1);
    game.key('ArrowLeft');
    game.key('ArrowLeft');
    expect(game.focus).toBe(0);
    game.key('ArrowRight');
    game.key('ArrowRight');
    game.key('ArrowRight');
    expect(game.focus).toBe(2);
    expect(game.key('ArrowUp').handled).toBe(true);
    expect(game.screen).toBe('bar');
    game.key('ArrowDown');
    expect(game.screen).toBe('board');
    game.key('ArrowUp');
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('board');
  });

  it('cycles the level Easy, Medium, Hard with an index tap', () => {
    const store = memoryStore();
    const game = new Game(store);
    game.key('ArrowUp');
    const levels = [];
    for (let i = 0; i < 4; i++) {
      game.key('Enter');
      levels.push(game.level);
    }
    expect(levels).toEqual(['hard', 'easy', 'medium', 'hard']);
    expect(game.screen).toBe('bar');
    expect(JSON.parse(store.text!).level).toBe('hard');
  });

  it('opens on the computer turn too', () => {
    const game = new Game(memoryStore());
    game.set(LOSS_NEXT, 'cpu');
    expect(game.key('ArrowUp').handled).toBe(true);
    expect(game.screen).toBe('bar');
  });

  it('asks before a new game in the middle of one; the abandoned game does not count', () => {
    const game = new Game(memoryStore());
    game.set(MID, 'you', {tally: {you: 3, cpu: 1, draw: 0}});
    game.key('ArrowUp');
    game.key('ArrowLeft');
    game.key('Enter');
    expect(game.screen).toBe('newgame');
    expect(game.rows()[game.focus]).toBe('start');
    // Back: to the bar, on New game.
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('bar');
    expect(game.focus).toBe(0);
    game.key('Enter');
    game.key('ArrowDown');
    game.key('Enter'); // Keep playing
    expect(game.screen).toBe('board');
    expect(game.rowsOfCells()).toEqual(MID);
    game.key('ArrowUp');
    game.key('ArrowLeft');
    game.key('Enter');
    game.key('Enter'); // Start over
    expect(game.screen).toBe('board');
    expect(game.rowsOfCells()).toEqual(EMPTY);
    expect(game.tally).toEqual({you: 3, cpu: 1, draw: 0});
    expect(game.starter).toBe(CPU);
  });

  it('starts at once on an empty board', () => {
    const game = new Game(memoryStore());
    game.key('ArrowUp');
    game.key('ArrowLeft');
    game.key('Enter');
    expect(game.screen).toBe('board');
    expect(game.turn).toBe(CPU);
  });

  it('opens How to play; an index tap or Back goes back to the bar', () => {
    const game = new Game(memoryStore());
    game.key('ArrowUp');
    game.key('ArrowRight');
    game.key('Enter');
    expect(game.screen).toBe('howto');
    expect(game.key('ArrowDown').handled).toBe(true);
    expect(game.screen).toBe('howto');
    expect(game.key('Enter').handled).toBe(true);
    expect(game.screen).toBe('bar');
    expect(game.focus).toBe(2);
    game.key('Enter');
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('bar');
  });
});

describe('the saved game', () => {
  it('comes back as it was', () => {
    const store = memoryStore();
    const game = new Game(store);
    game.set(MID, 'you', {last: [3, 4], tally: {you: 3, cpu: 1, draw: 2}, aim: 5});
    game.key('ArrowUp');
    game.key('Enter'); // Hard
    game.key('ArrowDown');
    game.key('ArrowDown'); // drops in column 5
    expect(JSON.parse(store.text!)).toMatchObject({
      v: 1, turn: 'cpu', next: 'cpu', level: 'hard', tally: {you: 3, cpu: 1, draw: 2}, aim: 5, last: 25, firstSeen: true,
    });
    const again = new Game(store);
    expect(again.rowsOfCells()).toEqual(game.rowsOfCells());
    expect(again.turn).toBe(CPU);
    expect(again.thinking).toBe(true);
    expect(again.next).toBe(CPU);
    expect(again.level).toBe('hard');
    expect(again.tally).toEqual({you: 3, cpu: 1, draw: 2});
    expect(again.aim).toBe(5);
    expect(again.last).toBe(25);
    expect(again.firstCard).toBe(false);
    expect(again.screen).toBe('board');
  });

  it('brings a finished game back on its end screen, counted once', () => {
    const store = memoryStore();
    const game = new Game(store);
    game.set(WIN_NEXT, 'you', {aim: 3});
    game.key('ArrowDown');
    const again = new Game(store);
    expect(again.screen).toBe('end');
    expect(again.result).toBe('you');
    expect(again.line?.kind).toBe('diagonal');
    expect(again.tally).toEqual({you: 1, cpu: 0, draw: 0});
    expect(again.next).toBe(CPU);
  });

  it('starts fresh when broken, keeping the tally and the level it can read', () => {
    const broken = [
      'not json', '"text"', '42', 'null', '{"board": "x"}', '{"board": ["......."], "turn": "you"}',
      // A floating disc.
      '{"board": [".......",".......",".......","...Y...",".......","......."], "turn": "cpu"}',
      // A turn that doesn't match the discs: you have one more and it's yours again.
      '{"board": [".......",".......",".......",".......",".......","...Y..."], "turn": "you"}',
      // Two more discs for you.
      '{"board": [".......",".......",".......",".......",".......","..YYY.C"], "turn": "cpu"}',
      // Both sides with four.
      '{"board": [".......",".......","Y.....C","Y.....C","Y.....C","Y.....C"], "turn": "you"}',
      '{"board": [".......",".......",".......",".......",".......","......."], "turn": "x"}',
    ];
    for (const text of broken) {
      const game = new Game(memoryStore(text));
      expect(game.rowsOfCells(), text).toEqual(EMPTY);
      expect(game.turn, text).toBe(YOU);
      expect(game.screen, text).toBe('board');
    }
    const kept = new Game(memoryStore('{"board": null, "level": "easy", "tally": {"you": 5, "cpu": 2, "draw": 1}, "firstSeen": true}'));
    expect(kept.level).toBe('easy');
    expect(kept.tally).toEqual({you: 5, cpu: 2, draw: 1});
    expect(kept.firstCard).toBe(false);
    const badTally = new Game(memoryStore('{"board": null, "level": "expert", "tally": {"you": -1, "cpu": 2, "draw": 1}}'));
    expect(badTally.level).toBe('medium');
    expect(badTally.tally).toEqual({you: 0, cpu: 0, draw: 0});
    // A broken aim or last move is dropped, the board is kept.
    const loose = new Game(memoryStore(JSON.stringify({board: MID, turn: 'you', aim: 'x', last: 2})));
    expect(loose.rowsOfCells()).toEqual(MID);
    expect(loose.aim).toBe(3);
    expect(loose.last).toBe(-1);
  });

  it('lives under one key', () => {
    expect(STORAGE_KEY).toBe('lumen-four-in-a-row');
  });
});
