/** Runs the computer's search off the page's thread, so the screen and the band never wait on it. */
import {type Level, chooseMove} from './ai';
import type {Cells, Side} from './board';
import {Rng} from './rng';

export interface ThinkRequest {
  id: number;
  cells: Cells;
  side: Side;
  level: Level;
  seed: number;
  budgetMs: number;
}

export interface ThinkReply {
  id: number;
  col: number;
  depth: number;
  nodes: number;
}

self.onmessage = (event: MessageEvent<ThinkRequest>) => {
  const {id, cells, side, level, seed, budgetMs} = event.data;
  const thought = chooseMove(cells, side, level, {rng: new Rng(seed), budgetMs});
  const reply: ThinkReply = {id, ...thought};
  self.postMessage(reply);
};
