/**
 * The approved design's "Rokid" palette. The glasses' display is green only and additive: black
 * is see-through and every color is a brightness, so the two sides differ in shape, not hue:
 * your discs are filled, the computer's are rings with a center dot.
 */
export const UI = {
  bg: '#000000',
  text: '#E2FFEE',
  sub: '#B8FFD6',
  hint: '#8DF0B5',
  line: '#2E7D50',
  cell: '#0B2416',
  board: '#04140B',
  panel: '#03100A',
  ring: '#F0FFF6',
  accent: '#F0FFF6',
  focus: '#123A24',
  // The game.
  frame: '#2E7D50',
  hole: '#1F5C3A',
  aim: '#0C2A19',
  you: '#9DFFC4',
  youRim: '#E2FFEE',
  cpu: '#E2FFEE',
  ghost: '#8DF0B5',
  mark: '#F0FFF6',
  win: '#FFFFFF',
  chip: '#E2FFEE',
  chipText: '#021008',
  trail: '#5CD890',
} as const;

/** The computer's ring width and center dot for a disc of [size] px, as the design draws them. */
export function ringOf(size: number): {ring: number; dot: number} {
  return {ring: Math.max(3, Math.round(size * 0.11)), dot: Math.max(6, Math.round(size * 0.24))};
}
