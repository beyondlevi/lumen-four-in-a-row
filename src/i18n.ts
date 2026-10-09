/**
 * Every text the game shows. English is the default; Brazilian Portuguese for any pt-* (the
 * glasses run pt-PT). `{name}` is a placeholder, filled with [fill]; `\n` breaks a line.
 */
const en = {
  // The wordmark: the game's name, the same in every language (like the app's name).
  wordTop: 'FOUR',
  wordBottom: 'IN A ROW',
  tallyYou: 'YOU',
  tallyCpu: 'CPU',
  tallyDraw: 'DRAW',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  newGame: 'New game',
  level: 'Level',
  howToPlay: 'How to play',
  board: 'Board',
  playHint: 'Left/right: aim · Down or index tap: drop · Up: menu · Middle tap: exit',
  cpuHint: "Computer's turn · Up: menu · Middle tap: exit (the game is saved)",
  thinking: 'Thinking',
  firstTitle: 'AIM, THEN DROP',
  firstText: 'Swipe left or right to aim.\nSwipe down or index tap to drop.\nGet four in a row to win.',
  you: 'You',
  computer: 'Computer',
  barNewText: 'Index tap: start a new game\n{next}',
  barNextYou: 'You start the next one.',
  barNextCpu: 'The computer starts the next one.',
  barLevelText: "Index tap: next level (Easy, Medium, Hard)\nIt applies from the computer's next move.",
  barHowText: 'Index tap: how to play\nThe rules, the levels and the controls.',
  barNewHint: 'Left/right: buttons · Index tap: new game · Down: back to the board',
  barLevelHint: 'Left/right: buttons · Index tap: next level · Down: back to the board',
  barHowHint: 'Left/right: buttons · Index tap: open · Down: back to the board',
  howTitle: 'HOW TO PLAY',
  howSides: 'You vs the computer',
  howSidesText: 'Your discs are filled. Its discs are rings.',
  howAim: 'Aim, then drop',
  howAimText: 'Swipe to aim. Down or index tap drops it.',
  howFour: 'Four in a row wins',
  howFourText: 'Across, up or diagonal. Full board: a draw.',
  howLast: 'Last move',
  howLastText: "Corners mark the computer's last disc.",
  howControls: 'Swipe up: New game · Level · How to play\nThree levels: Easy, Medium, Hard. Who starts alternates.\nMiddle tap: exit. The game waits, saved, for your return.',
  howHint: 'Index tap or middle tap: back',
  newTitle: 'NEW GAME?',
  newText: "This game won't count in the tally.",
  startOver: 'Start over',
  keepPlaying: 'Keep playing',
  listHint: 'Swipe up or down · Index tap: choose · Middle tap: back',
  youWin: 'YOU WIN!',
  cpuWins: 'COMPUTER WINS',
  drawTitle: "IT'S A DRAW",
  fourAcross: 'Four across · {level}',
  fourColumn: 'Four in a column · {level}',
  fourDiagonal: 'Four on the diagonal · {level}',
  drawText: 'Board full, no four · {level}',
  playAgain: 'Play again',
  youStart: 'you start',
  cpuStarts: 'computer starts',
  endHint: 'Swipe up or down · Index tap: choose · Middle tap: exit',
};

export type Strings = typeof en;

const pt: Strings = {
  wordTop: 'FOUR',
  wordBottom: 'IN A ROW',
  tallyYou: 'VOCÊ',
  tallyCpu: 'CPU',
  tallyDraw: 'EMPATE',
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  newGame: 'Novo jogo',
  level: 'Nível',
  howToPlay: 'Como jogar',
  board: 'Tabuleiro',
  playHint: 'Lados: mirar · Baixo ou indicador: soltar · Cima: menu · Médio: sair',
  cpuHint: 'Vez do computador · Cima: menu · Médio: sair (o jogo fica salvo)',
  thinking: 'Pensando',
  firstTitle: 'MIRE E SOLTE',
  firstText: 'Deslize para os lados para mirar.\nPara soltar: baixo ou indicador.\nFaça quatro em linha para vencer.',
  you: 'Você',
  computer: 'Computador',
  barNewText: 'Indicador: começar um novo jogo\n{next}',
  barNextYou: 'Você começa o próximo.',
  barNextCpu: 'O computador começa o próximo.',
  barLevelText: 'Indicador: próximo nível (Fácil, Médio, Difícil)\nVale a partir da próxima jogada do computador.',
  barHowText: 'Indicador: como jogar\nAs regras, os níveis e os controles.',
  barNewHint: 'Lados: botões · Indicador: novo jogo · Baixo: voltar ao tabuleiro',
  barLevelHint: 'Lados: botões · Indicador: próximo nível · Baixo: voltar ao tabuleiro',
  barHowHint: 'Lados: botões · Indicador: abrir · Baixo: voltar ao tabuleiro',
  howTitle: 'COMO JOGAR',
  howSides: 'Você contra o computador',
  howSidesText: 'Suas peças são cheias. As dele são anéis.',
  howAim: 'Mire e solte',
  howAimText: 'Deslize para mirar. Baixo ou indicador solta.',
  howFour: 'Quatro em linha vence',
  howFourText: 'Em qualquer direção. Cheio: empate.',
  howLast: 'Última jogada',
  howLastText: 'Cantos marcam a última do computador.',
  howControls: 'Deslize para cima: Novo jogo · Nível · Como jogar\nTrês níveis: Fácil, Médio, Difícil. Quem começa alterna.\nMédio: sair. O jogo fica salvo esperando você voltar.',
  howHint: 'Indicador ou médio: voltar',
  newTitle: 'NOVO JOGO?',
  newText: 'Este jogo não vai contar no placar.',
  startOver: 'Começar de novo',
  keepPlaying: 'Continuar jogando',
  listHint: 'Deslize para cima ou baixo · Indicador: escolher · Médio: voltar',
  youWin: 'VOCÊ VENCEU!',
  cpuWins: 'VOCÊ PERDEU',
  drawTitle: 'DEU EMPATE',
  fourAcross: 'Quatro na horizontal · {level}',
  fourColumn: 'Quatro na vertical · {level}',
  fourDiagonal: 'Quatro na diagonal · {level}',
  drawText: 'Tabuleiro cheio, sem quatro · {level}',
  playAgain: 'Jogar de novo',
  youStart: 'você começa',
  cpuStarts: 'computador começa',
  endHint: 'Deslize para cima ou baixo · Indicador: escolher · Médio: sair',
};

const catalogs: Record<string, Strings> = {en, pt};

/** The base language used for [language] (a BCP 47 tag): one with a catalog, else English. */
export function languageFor(language: string | undefined): 'en' | 'pt' {
  const base = (language ?? 'en').toLowerCase().split('-')[0];
  return base === 'pt' ? 'pt' : 'en';
}

/** The strings for [language]: its base language if there is a catalog, else English. */
export function stringsFor(language: string | undefined): Strings {
  return catalogs[languageFor(language)] ?? en;
}

/** Formats a number for [language]: 1,024 in English, 1.024 in Brazilian Portuguese. */
export function numberFormat(language: string | undefined): (n: number) => string {
  const format = new Intl.NumberFormat(languageFor(language) === 'pt' ? 'pt-BR' : 'en-US');
  return (n) => format.format(n);
}

/** Fills `{name}` placeholders. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const catalogsForTests = {en, pt};
