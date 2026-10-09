/** The 7 x 6 board and its rules, with no state and no DOM. Row 0 is the top row. */
export const COLS = 7;
export const ROWS = 6;
export const CELLS = COLS * ROWS;

export const EMPTY = 0;
export const YOU = 1;
export const CPU = 2;
export type Side = typeof YOU | typeof CPU;
export type Disc = typeof EMPTY | Side;

/** 42 discs, row by row from the top: cell = row * 7 + col. */
export type Cells = Disc[];

/** How four were made: across a row, up a column, or on one of the two diagonals. */
export type LineKind = 'across' | 'column' | 'diagonal';

export interface Line {
  kind: LineKind;
  /** The cells of the line, in order from one end to the other (four or more). */
  cells: number[];
}

export const other = (side: Side): Side => (side === YOU ? CPU : YOU);
export const cellOf = (row: number, col: number): number => row * COLS + col;
export const rowOf = (cell: number): number => Math.floor(cell / COLS);
export const colOf = (cell: number): number => cell % COLS;

export function emptyBoard(): Cells {
  return new Array<Disc>(CELLS).fill(EMPTY);
}

/** The row a disc dropped in [col] lands on, or -1 when the column is full (or not a column). */
export function landing(cells: Cells, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (cells[cellOf(row, col)] === EMPTY) return row;
  }
  return -1;
}

export function canDrop(cells: Cells, col: number): boolean {
  return landing(cells, col) >= 0;
}

/** The columns that still take a disc, left to right. */
export function openColumns(cells: Cells): number[] {
  const result: number[] = [];
  for (let col = 0; col < COLS; col++) if (canDrop(cells, col)) result.push(col);
  return result;
}

export function isFull(cells: Cells): boolean {
  return openColumns(cells).length === 0;
}

/** Drops [side]'s disc in [col]: the new board and the cell it landed on, or null for a full column. */
export function drop(cells: Cells, col: number, side: Side): {cells: Cells; cell: number} | null {
  const row = landing(cells, col);
  if (row < 0) return null;
  const next = cells.slice();
  const cell = cellOf(row, col);
  next[cell] = side;
  return {cells: next, cell};
}

const DIRECTIONS: [dr: number, dc: number, kind: LineKind][] = [[0, 1, 'across'], [1, 0, 'column'], [1, 1, 'diagonal'], [1, -1, 'diagonal']];

/** The line of four or more through [cell] made by its disc, or null. */
export function lineThrough(cells: Cells, cell: number): Line | null {
  const side = cells[cell];
  if (side === EMPTY) return null;
  const row = rowOf(cell);
  const col = colOf(cell);
  for (const [dr, dc, kind] of DIRECTIONS) {
    const run = [cell];
    for (const sign of [-1, 1]) {
      let r = row + sign * dr;
      let c = col + sign * dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cells[cellOf(r, c)] === side) {
        if (sign < 0) run.unshift(cellOf(r, c));
        else run.push(cellOf(r, c));
        r += sign * dr;
        c += sign * dc;
      }
    }
    if (run.length >= 4) return {kind, cells: run};
  }
  return null;
}

/** [side]'s first line of four on the board, or null. */
export function findLine(cells: Cells, side: Side): Line | null {
  for (let cell = 0; cell < CELLS; cell++) {
    if (cells[cell] !== side) continue;
    const line = lineThrough(cells, cell);
    if (line) return line;
  }
  return null;
}

export function count(cells: Cells, side: Side): number {
  return cells.reduce<number>((n, disc) => n + (disc === side ? 1 : 0), 0);
}

const CHARS: Record<Disc, string> = {[EMPTY]: '.', [YOU]: 'Y', [CPU]: 'C'};

/** The board as 6 strings of 7 characters: '.' empty, 'Y' yours, 'C' the computer's. */
export function toRows(cells: Cells): string[] {
  const rows: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    rows.push(cells.slice(row * COLS, row * COLS + COLS).map((disc) => CHARS[disc]).join(''));
  }
  return rows;
}

/**
 * The cells of 6 rows of 7 characters, or null when [rows] isn't a board that a game can reach:
 * a wrong shape or character, a disc floating over an empty cell, or both sides with four.
 */
export function fromRows(rows: unknown): Cells | null {
  if (!Array.isArray(rows) || rows.length !== ROWS) return null;
  const cells: Cells = [];
  for (const row of rows) {
    if (typeof row !== 'string' || !/^[.YC]{7}$/.test(row)) return null;
    for (const ch of row) cells.push(ch === 'Y' ? YOU : ch === 'C' ? CPU : EMPTY);
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 1; row < ROWS; row++) {
      if (cells[cellOf(row, col)] === EMPTY && cells[cellOf(row - 1, col)] !== EMPTY) return null;
    }
  }
  if (findLine(cells, YOU) && findLine(cells, CPU)) return null;
  return cells;
}
