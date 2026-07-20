// Raffle core — PURE functions, no dependency on `spresenter`.
// Imported by both the UI (preview via srcDoc) and the logic thread (code.ts),
// so the preview and the live output are ALWAYS identical: the UI picks the
// winner (browser RNG) and passes {style, candidates, winnerIndex, token}; the
// builder is deterministic from there (jitter/shuffle derive from the token via
// hash — same string, same result on both sides).

export type RaffleMode = 'range' | 'names';
export type RaffleStyle = 'wheel' | 'vertical';

export interface BuildOpts {
  style: RaffleStyle;
  candidates: string[];
  winnerIndex: number;
  token: string;
  transparent?: boolean;
  title?: string;
}

// ─── candidates ──────────────────────────────────────────────────────────────

/** Names: one entry per line; trims whitespace and drops empty lines. */
export function parseNames(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Inclusive integer range [min, max] (reorders them if swapped). */
export function rangeCandidates(min: number, max: number): string[] {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  const out: string[] = [];
  for (let n = lo; n <= hi; n++) out.push(String(n));
  return out;
}

// ─── deterministic PRNG (seeded from the token) ──────────────────────────────

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ─── public builder ──────────────────────────────────────────────────────────

const WHEEL_DURATION = 6200;
const VERTICAL_DURATION = 5200;
const MAX_WHEEL_SEGMENTS = 60; // above this, sample (always keeping the winner)

export function buildStageHtml(opts: BuildOpts): string {
  const winner = opts.candidates[opts.winnerIndex] ?? '';
  const inner =
    opts.style === 'wheel' ? buildWheel(opts) : buildVertical(opts);
  const id = `sr-${opts.token}`;
  const dur = opts.style === 'wheel' ? WHEEL_DURATION : VERTICAL_DURATION;
  const bg = opts.transparent
    ? 'transparent'
    : 'radial-gradient(circle at 50% 28%, #1e293b, #0b1120 72%)';
  const titleHtml = opts.title
    ? `<div class="title">${escapeHtml(opts.title)}</div>`
    : '';

  return `
<div id="${id}" class="scene">
  ${titleHtml}
  ${inner.markup}
  <div class="result">${escapeHtml(truncate(winner, 42))}</div>
</div>
<style>
#${id}.scene{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;overflow:hidden;
  font-family:'Inter','Segoe UI',Arial,sans-serif;color:#fff;background:${bg};}
#${id} .title{position:absolute;top:5vh;font-size:5vh;font-weight:800;
  letter-spacing:.01em;text-shadow:0 2px 14px rgba(0,0,0,.6);}
#${id} .result{position:absolute;bottom:6vh;max-width:88vw;text-align:center;
  font-size:4.6vh;font-weight:800;line-height:1.15;padding:.35em 1.1em;
  border-radius:999px;color:#1a1206;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;background:linear-gradient(90deg,#fbbf24,#f97316);
  box-shadow:0 10px 34px rgba(0,0,0,.5);opacity:0;transform:scale(.7);
  animation:reveal-${opts.token} .55s cubic-bezier(.2,1.5,.4,1) ${dur - 250}ms forwards;}
@keyframes reveal-${opts.token}{to{opacity:1;transform:scale(1)}}
${inner.css}
</style>`.trim();
}

// ─── WHEEL (spinning wheel) ───────────────────────────────────────────────────

function buildWheel(opts: BuildOpts): { markup: string; css: string } {
  const id = `sr-${opts.token}`;
  const rand = mulberry32(hashStr(opts.token));

  // If there are too many segments, sample a subset (always including the
  // winner) so the wheel stays legible. The displayed result uses the real value.
  let items = opts.candidates;
  let winnerPos = opts.winnerIndex;
  if (items.length > MAX_WHEEL_SEGMENTS) {
    const picked = new Set<number>([opts.winnerIndex]);
    while (picked.size < MAX_WHEEL_SEGMENTS) {
      picked.add(Math.floor(rand() * items.length));
    }
    const idx = Array.from(picked).sort((a, b) => a - b);
    winnerPos = idx.indexOf(opts.winnerIndex);
    items = idx.map((i) => opts.candidates[i]);
  }

  const n = Math.max(1, items.length);
  const sector = 360 / n;
  const R = 48; // radius in the 100x100 viewBox
  const cx = 50;
  const cy = 50;
  const labelR = 32;
  const fs = Math.max(2.1, Math.min(5.2, 26 / Math.sqrt(n)));

  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180; // 0° at the top, clockwise
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const paths: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = i * sector;
    const a1 = (i + 1) * sector;
    const [x0, y0] = toXY(a0, R);
    const [x1, y1] = toXY(a1, R);
    const large = sector > 180 ? 1 : 0;
    const hue = Math.round((i * 360) / n);
    const fill = `hsl(${hue} 68% ${i % 2 ? 46 : 54}%)`;
    if (n === 1) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}"/>`);
    } else {
      paths.push(
        `<path d="M${cx} ${cy} L${x0.toFixed(3)} ${y0.toFixed(3)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z" fill="${fill}"/>`,
      );
    }
    const mid = (i + 0.5) * sector;
    const flip = mid > 90 && mid < 270;
    const ty = cy - labelR;
    labels.push(
      `<g transform="rotate(${mid.toFixed(3)} ${cx} ${cy})">` +
        `<text x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="central" ` +
        `font-size="${fs.toFixed(2)}" font-weight="700" fill="#fff" ` +
        `style="paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:.25px" ` +
        `transform="${flip ? `rotate(180 ${cx} ${ty})` : ''}">` +
        escapeHtml(truncate(items[i], 16)) +
        `</text></g>`,
    );
  }

  // Final rotation: spinning the wheel clockwise brings the center of the
  // winning sector up to the pointer (top). center = (winnerPos+0.5)*sector.
  const turns = 6;
  const jitter = (rand() - 0.5) * sector * 0.6; // don't always stop dead center
  const center = (winnerPos + 0.5) * sector + jitter;
  const finalDeg = 360 * turns - center;

  const markup = `
  <div class="wheel-wrap">
    <div class="pointer"></div>
    <svg class="wheel" viewBox="0 0 100 100" aria-hidden="true">
      <g class="disc">
        <circle cx="${cx}" cy="${cy}" r="${R + 1.2}" fill="rgba(0,0,0,.25)"/>
        ${paths.join('')}
        ${labels.join('')}
      </g>
    </svg>
    <div class="hub"></div>
  </div>`;

  const css = `
#${id} .wheel-wrap{position:relative;width:min(76vh,76vw);aspect-ratio:1;}
#${id} .wheel{width:100%;height:100%;transform-origin:50% 50%;
  filter:drop-shadow(0 12px 30px rgba(0,0,0,.5));
  animation:spin-${opts.token} ${WHEEL_DURATION}ms cubic-bezier(.10,.62,.16,1) forwards;}
#${id} .pointer{position:absolute;top:-3.2%;left:50%;transform:translateX(-50%);
  width:0;height:0;border-left:2.4vh solid transparent;border-right:2.4vh solid transparent;
  border-top:4.4vh solid #fbbf24;z-index:5;filter:drop-shadow(0 3px 5px rgba(0,0,0,.55));}
#${id} .hub{position:absolute;top:50%;left:50%;width:10%;height:10%;
  transform:translate(-50%,-50%);border-radius:50%;background:#fff;
  box-shadow:0 2px 10px rgba(0,0,0,.45),inset 0 0 0 .4vh #fbbf24;z-index:4;}
@keyframes spin-${opts.token}{from{transform:rotate(0)}to{transform:rotate(${finalDeg.toFixed(3)}deg)}}`;

  return { markup, css };
}

// ─── VERTICAL (slot machine / random roll) ───────────────────────────────────

function buildVertical(opts: BuildOpts): { markup: string; css: string } {
  const id = `sr-${opts.token}`;
  const rand = mulberry32(hashStr(opts.token));
  const base = opts.candidates;
  const n = Math.max(1, base.length);

  // Build the "reel": several shuffled passes + the winning cell at the end,
  // followed by a few padding cells (so the winner isn't the very last one).
  const loops = Math.min(10, Math.max(3, Math.ceil(28 / n)));
  const cells: string[] = [];
  const MAX_CELLS = 320;
  for (let p = 0; p < loops && cells.length < MAX_CELLS; p++) {
    const order = base.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const i of order) cells.push(base[i]);
  }
  cells.push(base[opts.winnerIndex]); // stop cell
  const winPos = cells.length - 1;
  for (let k = 0; k < 2; k++) cells.push(base[Math.floor(rand() * n)]);

  // 3 visible cells (20vh each, 60vh window); winner in the middle slot.
  const finalTY = -(winPos - 1) * 20; // vh

  const cellHtml = cells
    .map(
      (c, i) =>
        `<div class="cell${i === winPos ? ' win' : ''}">${escapeHtml(truncate(c, 26))}</div>`,
    )
    .join('');

  const fades = opts.transparent
    ? ''
    : `<div class="fade fade-top"></div><div class="fade fade-bot"></div>`;

  const markup = `
  <div class="reel-window">
    <div class="reel">${cellHtml}</div>
    ${fades}
    <div class="slot"></div>
  </div>`;

  const fadeCss = opts.transparent
    ? ''
    : `#${id} .fade{position:absolute;left:0;width:100%;height:20vh;z-index:2;pointer-events:none;}
#${id} .fade-top{top:0;background:linear-gradient(#0b1120,rgba(11,17,32,0));}
#${id} .fade-bot{bottom:0;background:linear-gradient(rgba(11,17,32,0),#0b1120);}`;

  const css = `
#${id} .reel-window{position:relative;width:min(62vw,760px);height:60vh;
  overflow:hidden;border-radius:2.4vh;background:rgba(255,255,255,.05);
  box-shadow:inset 0 0 0 .3vh rgba(255,255,255,.10),0 16px 44px rgba(0,0,0,.5);}
#${id} .reel{position:absolute;top:0;left:0;width:100%;will-change:transform,filter;
  animation:roll-${opts.token} ${VERTICAL_DURATION}ms cubic-bezier(.07,.62,.14,1) forwards;}
#${id} .cell{height:20vh;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:0 4vw;box-sizing:border-box;font-size:6.4vh;font-weight:800;
  color:#e2e8f0;text-shadow:0 2px 10px rgba(0,0,0,.5);}
#${id} .cell:nth-child(2n){color:#cbd5e1;}
#${id} .slot{position:absolute;top:20vh;left:0;width:100%;height:20vh;z-index:3;
  pointer-events:none;border-radius:1.4vh;
  box-shadow:inset 0 0 0 .35vh #fbbf24,inset 0 0 60px rgba(251,191,36,.28);}
${fadeCss}
@keyframes roll-${opts.token}{
  0%{transform:translateY(0);filter:blur(0)}
  18%{filter:blur(7px)}
  88%{filter:blur(1.5px)}
  100%{transform:translateY(${finalTY.toFixed(2)}vh);filter:blur(0)}}`;

  return { markup, css };
}
