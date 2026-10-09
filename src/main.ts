import './style.css';
import {HARD_BUDGET_MS, LEVELS, type Level, chooseMove} from './ai';
import type {ThinkReply, ThinkRequest} from './ai.worker';
import {CPU} from './board';
import {Game, STORAGE_KEY, type Store, type Tally} from './game';
import {languageFor, numberFormat, stringsFor} from './i18n';
import {Rng} from './rng';
import {View} from './view';

/** "Thinking" stays at least this long, so the computer's turn reads. */
const MIN_THINK_MS = 400;

/**
 * The game, kept on the device after every change (each Lumen app has its own origin and
 * storage). A hidden app is suspended and Android may end its page; it comes back from here.
 */
const store: Store = {
  load() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save(text) {
    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch {
      // Private mode or full storage: the game lasts for this session.
    }
  },
};

const params = new URLSearchParams(location.search);
const language = languageFor(params.get('lang') ?? navigator.language);
const strings = stringsFor(language);
document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
const seed = Number(params.get('seed')) || (Date.now() & 0x7fffffff);
const rng = new Rng(seed);

const root = document.getElementById('game')!;
const game = new Game(store);
const view = new View(root, game, strings, numberFormat(language));

/**
 * The computer's search runs in a worker (a file of this package, same origin), so the page never
 * waits on it. Without workers it runs here, after the screen has shown "Thinking".
 */
class Computer {
  private worker: Worker | null = null;
  private waiting = new Map<number, (reply: ThinkReply) => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {type: 'module'});
      this.worker.onmessage = (event: MessageEvent<ThinkReply>) => {
        const done = this.waiting.get(event.data.id);
        this.waiting.delete(event.data.id);
        done?.(event.data);
      };
      this.worker.onerror = () => this.fallBack();
    } catch {
      this.worker = null;
    }
  }

  think(request: ThinkRequest, done: (reply: ThinkReply) => void): void {
    if (this.worker) {
      this.waiting.set(request.id, done);
      this.worker.postMessage(request);
      return;
    }
    window.setTimeout(() => {
      const thought = chooseMove(request.cells, request.side, request.level, {rng: new Rng(request.seed), budgetMs: request.budgetMs});
      done({id: request.id, ...thought});
    }, 30);
  }

  /** The worker failed: what it was thinking about is thought here instead. */
  private fallBack(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const id of [...this.waiting.keys()]) {
      const done = this.waiting.get(id)!;
      this.waiting.delete(id);
      const position = asked.get(id);
      if (position) this.think(position, done);
    }
  }
}

const computer = new Computer();
/** The requests on their way, by id (kept for the fallback). */
const asked = new Map<number, ThinkRequest>();
/** The computer's turn being played: the board it thinks about, and when "Thinking" showed. */
let turn: {id: number; board: string; since: number; timer: number} | null = null;
let nextId = 1;

/** Starts the computer's turn when it's its turn, and forgets one the game moved past. */
function schedule(delay = 0): void {
  const board = game.rowsOfCells().join('/');
  if (turn && (!game.thinking || turn.board !== board)) {
    clearTimeout(turn.timer);
    asked.delete(turn.id);
    turn = null;
  }
  if (!game.thinking || turn) return;
  const id = nextId++;
  const request: ThinkRequest = {id, cells: game.cells.slice(), side: CPU, level: game.level, seed: rng.int(0x7fffffff), budgetMs: HARD_BUDGET_MS};
  turn = {id, board, since: performance.now() + delay, timer: 0};
  asked.set(id, request);
  computer.think(request, (reply) => {
    asked.delete(id);
    if (!turn || turn.id !== id) return;
    const wait = Math.max(0, turn.since + MIN_THINK_MS - performance.now());
    turn.timer = window.setTimeout(() => play(id, reply.col), wait);
  });
}

/** The computer drops its disc, if the game is still where it thought about it. */
function play(id: number, col: number): void {
  if (!turn || turn.id !== id) return;
  turn = null;
  view.flush();
  const onBoard = game.screen === 'board';
  const drop = game.cpuDrop(col);
  if (drop && onBoard) view.drop(drop);
  else view.render();
  schedule();
}

/** Runs [key] like the band's: arrows, Enter (index tap), Escape (middle tap). True if the game used it. */
function press(key: string): boolean {
  view.flush();
  const result = game.key(key);
  const fall = result.drop ? view.drop(result.drop) : 0;
  if (!result.drop) view.render();
  schedule(fall);
  return result.handled;
}

// The band arrives as keys. Escape is Lumen's Back: prevented only when the game used it (to close
// the top bar or a screen); on the board and on the end screens it goes through and Lumen closes
// the app, with the game saved.
document.addEventListener('keydown', (event) => {
  if (event.repeat) {
    if (event.key === 'Escape' && ['bar', 'newgame', 'howto'].includes(game.screen)) event.preventDefault();
    else if (event.key.startsWith('Arrow') || event.key === 'Enter') event.preventDefault();
    return;
  }
  if (press(event.key)) event.preventDefault();
});

view.onBar = (button) => {
  view.flush();
  game.pressBar(button);
  view.render();
  schedule();
};
view.onActivate = (index) => {
  view.flush();
  game.activate(index);
  view.render();
  schedule();
};

/** Shrinks the 600 x 600 screen into a smaller window (a desktop browser); on the glasses it's 1:1. */
function fit(): void {
  const scale = Math.min(1, innerWidth / 600, innerHeight / 600);
  root.style.transform = scale < 1 ? `scale(${scale})` : '';
}
addEventListener('resize', fit);
fit();

// Hidden (the display off, another screen in front): the page is suspended, maybe ended. The game
// is saved already; back on screen, it's drawn again from its state.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    view.flush();
    game.save();
  } else {
    view.render();
    schedule();
  }
});
addEventListener('pageshow', () => view.render());
addEventListener('focus', () => view.focus());

async function start(): Promise<void> {
  view.render();
  const fonts = [
    new FontFace('Bungee', 'url(fonts/Bungee-Regular-latin.woff2)'),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-SemiBold-latin.woff2)', {weight: '500 600'}),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-Bold-latin.woff2)', {weight: '700'}),
  ];
  await Promise.all(fonts.map(async (font) => {
    try {
      document.fonts.add(await font.load());
    } catch {
      // A font that doesn't load falls back to the system's.
    }
  }));
  root.classList.remove('loading');
  view.render();
  // A game saved at the computer's turn goes on.
  schedule();
}

// The e2e test's hook, only with ?test=1.
if (params.get('test') === '1') {
  const sideName = (side: number) => (side === CPU ? 'cpu' : 'you');
  (window as unknown as {__four: unknown}).__four = {
    seed,
    state: () => ({
      screen: game.screen,
      rows: game.rowsOfCells(),
      turn: sideName(game.turn),
      next: sideName(game.next),
      starter: sideName(game.starter),
      level: game.level,
      tally: {...game.tally},
      aim: game.aim,
      last: game.last,
      result: game.result,
      line: game.line,
      firstCard: game.firstCard,
      firstSeen: game.firstSeen,
      thinking: game.thinking,
      falling: view.busy,
      focus: game.screen === 'bar' ? ['new', 'level', 'howto'][game.focus] : game.rows()[game.focus] ?? null,
      active: (() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.dataset.bar ?? el?.dataset.row ?? (el?.classList.contains('board') ? 'board' : el?.className ?? null);
      })(),
    }),
    set: (rows: string[], turnName: 'you' | 'cpu', options?: {last?: [number, number]; tally?: Tally; aim?: number}) => {
      view.flush();
      const ok = game.set(rows, turnName, options);
      view.render();
      schedule();
      return ok;
    },
    level: (level: number | Level) => {
      game.level = typeof level === 'number' ? LEVELS[level] : level;
      game.save();
      view.render();
    },
    key: (key: string) => press(key),
  };
}

void start();
