/** The design's stroke icons (24 x 24 viewBox), as SVG markup in `currentColor`. */
const PATHS = {
  new: '<path d="M20 12 A8 8 0 1 1 17.7 6.3"/><path d="M20 4 V8.5 H15.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 C9.5 7.5 14.5 7.5 14.5 10 C14.5 12 12 12 12 14"/><circle cx="12" cy="17.2" r="0.6"/>',
  play: '<path d="M8 5 L19 12 L8 19 Z"/>',
  back: '<path d="M15 6 L9 12 L15 18"/>',
  down: '<path d="M6 9 L12 15 L18 9"/>',
  left: '<path d="M15 6 L9 12 L15 18"/>',
  right: '<path d="M9 6 L15 12 L9 18"/>',
};

export type IconName = keyof typeof PATHS;

/** An icon drawn in `currentColor`, so it follows its row's text color. */
export function icon(name: IconName, size = 26): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** Three rising bars, the first [n] filled: Easy 1, Medium 2, Hard 3 (a shape cue, not a hue). */
export function levelIcon(n: number, size = 22): string {
  let bars = '';
  [[3, 14], [10, 9], [17, 4]].forEach(([x, y], i) => {
    bars += `<rect x="${x}" y="${y}" width="5" height="${21 - y}" rx="1" fill="${i < n ? 'currentColor' : 'none'}"/>`;
  });
  return `<svg class="level-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${bars}</svg>`;
}

/** Corner marks around a [size] px cell: the computer's last move. */
export function brackets(size: number, arm = 12, width = 3): string {
  const s = size;
  const d = `M1.5 ${arm} V1.5 H${arm} M${s - arm} 1.5 H${s - 1.5} V${arm} ` +
    `M${s - 1.5} ${s - arm} V${s - 1.5} H${s - arm} M${arm} ${s - 1.5} H1.5 V${s - arm}`;
  return `<svg class="mark" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" stroke="currentColor" ` +
    `stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** The help screen's picture of a win: four small filled discs on a diagonal, joined by the line. */
export function miniFour(you: string, rim: string, bg: string, win: string): string {
  const points = [0, 1, 2, 3].map((i) => [15 + i * 22, 53 - i * 14]);
  const circles = points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${you}" stroke="${rim}" stroke-width="1.5"/>`).join('');
  const [[x1, y1], [x2, y2]] = [points[0], points[3]];
  return `<svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke-linecap="round" aria-hidden="true">${circles}` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${bg}" stroke-width="6"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${win}" stroke-width="2.5"/></svg>`;
}

/** The motion lines above a falling disc: [x] is the disc's center, [top] its top edge. */
export function trail(x: number, top: number): string {
  return [[-13, 30, 10], [0, 46, 8], [13, 30, 10]]
    .map(([dx, length, gap]) => `<line x1="${x + dx}" y1="${top - gap - length}" x2="${x + dx}" y2="${top - gap}"/>`)
    .join('');
}
