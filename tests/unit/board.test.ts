import {describe, expect, it} from 'vitest';
import {
  CPU, type Cells, type Side, YOU, canDrop, cellOf, drop, emptyBoard, findLine, fromRows, isFull, landing, lineThrough,
  openColumns, toRows,
} from '../../src/board';

const board = (rows: string[]): Cells => {
  const cells = fromRows(rows);
  if (!cells) throw new Error(`not a board: ${rows.join('/')}`);
  return cells;
};

/** Drops [side]'s disc in [col] of [rows] and returns the line it makes, if any. */
const play = (rows: string[], col: number, side: Side = YOU) => {
  const done = drop(board(rows), col, side)!;
  return {cells: done.cells, cell: done.cell, line: lineThrough(done.cells, done.cell)};
};

describe('gravity', () => {
  it('drops a disc to the lowest empty cell of its column', () => {
    let cells = emptyBoard();
    expect(landing(cells, 3)).toBe(5);
    const first = drop(cells, 3, YOU)!;
    expect(first.cell).toBe(cellOf(5, 3));
    cells = first.cells;
    const second = drop(cells, 3, CPU)!;
    expect(second.cell).toBe(cellOf(4, 3));
    expect(toRows(second.cells)).toEqual(['.......', '.......', '.......', '.......', '...C...', '...Y...']);
    // The board it came from is left as it was.
    expect(toRows(cells)[4]).toBe('.......');
  });

  it('refuses a full column and a column that does not exist', () => {
    const cells = board(['Y......', 'C......', 'Y......', 'C......', 'Y......', 'C......']);
    expect(canDrop(cells, 0)).toBe(false);
    expect(landing(cells, 0)).toBe(-1);
    expect(drop(cells, 0, YOU)).toBeNull();
    for (const col of [-1, 7, 2.5, Number.NaN]) {
      expect(canDrop(cells, col)).toBe(false);
      expect(drop(cells, col, YOU)).toBeNull();
    }
    expect(openColumns(cells)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('only reads boards a game can reach', () => {
    expect(fromRows(['.......', '.......', '.......', '.......', '.......', '.......'])).not.toBeNull();
    // A disc over an empty cell.
    expect(fromRows(['.......', '.......', '.......', '...Y...', '.......', '...C...'])).toBeNull();
    // Wrong sizes and characters.
    expect(fromRows(['.......'])).toBeNull();
    expect(fromRows(['........', '.......', '.......', '.......', '.......', '.......'])).toBeNull();
    expect(fromRows(['.......', '.......', '.......', '.......', '.......', '...X...'])).toBeNull();
    expect(fromRows('.......')).toBeNull();
    expect(fromRows(null)).toBeNull();
    // Both sides with four.
    expect(fromRows(['.......', '.......', 'Y.....C', 'Y.....C', 'Y.....C', 'Y.....C'])).toBeNull();
  });
});

describe('four in a row', () => {
  it('wins across, at both edges', () => {
    const left = play(['.......', '.......', '.......', '.......', '.......', 'YYY.CCC'], 3);
    expect(left.line).toEqual({kind: 'across', cells: [35, 36, 37, 38]});
    const right = play(['.......', '.......', '.......', '.......', '.......', 'CC.YYYC'], 2, CPU);
    expect(right.line).toBeNull();
    const edge = play(['.......', '.......', '.......', '.......', '...YYY.', '..CCCYC'], 6);
    expect(edge.line?.kind).toBe('across');
    expect(edge.line?.cells).toEqual([31, 32, 33, 34]);
  });

  it('wins up a column, also at the top', () => {
    const low = play(['.......', '.......', '.......', 'Y......', 'Y......', 'Y......'], 0);
    expect(low.line).toEqual({kind: 'column', cells: [14, 21, 28, 35]});
    const top = play(['.......', '......C', '......C', '......C', '......Y', '......Y'], 6, CPU);
    expect(top.line).toEqual({kind: 'column', cells: [6, 13, 20, 27]});
  });

  it('wins on both diagonals, from a corner to the far edge', () => {
    // Rising to the right, ending at the top row.
    const rising = play(['.......', '..CY...', '.CCC...', 'CYYC...', 'YCCY...', 'YYYC...'], 3, CPU);
    expect(rising.line).toEqual({kind: 'diagonal', cells: [3, 9, 15, 21]});
    // Falling to the right, from the top-left corner.
    const corner = play(['.......', 'CY.....', 'CCY....', 'YCCY...', 'CYYY...', 'YCYC...'], 0);
    expect(corner.line).toEqual({kind: 'diagonal', cells: [0, 8, 16, 24]});
    // Rising to the right from the bottom-right corner.
    const low = play(['.......', '.......', '...Y...', '...CY..', '...CCY.', '...CYC.'], 6);
    expect(low.line).toEqual({kind: 'diagonal', cells: [17, 25, 33, 41]});
  });

  it('counts five in a row as one line through the last disc', () => {
    const five = play(['.......', '.......', '.......', '.......', '.......', 'YY.YYCC'], 2);
    expect(five.line).toEqual({kind: 'across', cells: [35, 36, 37, 38, 39]});
  });

  it('needs four: three is not a line', () => {
    expect(play(['.......', '.......', '.......', '.......', '.......', 'YY.CCC.'], 2).line).toBeNull();
    expect(play(['.......', '.......', '.......', '.......', 'Y......', 'Y......'], 0).line).toBeNull();
    expect(findLine(board(['.......', '.......', '.......', '.......', '.......', 'YYY.CCC']), YOU)).toBeNull();
  });
});

describe('a full board', () => {
  it('is a draw when nobody has four', () => {
    // The design's draw board, one disc short.
    const rows = ['CYCYCY.', 'YCYYYCY', 'YYYCCYC', 'CCCYCCC', 'YCYCYYY', 'YCCYYCC'];
    expect(isFull(board(rows))).toBe(false);
    const last = play(rows, 6, CPU);
    expect(last.line).toBeNull();
    expect(isFull(last.cells)).toBe(true);
    expect(findLine(last.cells, YOU)).toBeNull();
    expect(findLine(last.cells, CPU)).toBeNull();
    expect(openColumns(last.cells)).toEqual([]);
  });
});
