// Logic thread of the Raffle plugin. Runs isolated and talks to the app through
// the global `spresenter`. The UI picks the winner (RNG) and sends the params;
// here we only compose the stage presentation (once per output/layer) and push
// the animated HTML — deterministic from {style, candidates, winnerIndex,
// token} — into the `stage` element via a raw-HTML override.

import { buildStageHtml, type RaffleStyle } from './shared/raffle';

interface SpinMsg {
  type: 'spin';
  output: string | number;
  layer: number;
  style: RaffleStyle;
  candidates: string[];
  winnerIndex: number;
  token: string;
  transparent?: boolean;
  title?: string;
}
interface SimpleMsg {
  type: 'init' | 'clear';
  output?: string | number;
  layer?: number;
}
type UiMsg = SpinMsg | SimpleMsg;

// Full-screen stage: a single `stage` element that we fill with raw HTML.
function buildStagePresentation() {
  return {
    title: 'Raffle',
    asset: { type: 'presentation', guid: 'plugin-raffle-stage', title: 'Raffle' },
    theme: {
      title: 'Raffle',
      css: {},
      elements: [
        {
          id: 'stage',
          type: 'RECTANGLE',
          x: 0,
          y: 0,
          visible: true,
          css: { position: 'absolute', width: '100%', height: '100%' },
        },
      ],
    },
    props: {},
  };
}

// Where the stage was already applied ("output:layer"). Avoids re-applying (and
// the crossfade) on every draw to the same target.
let liveKey: string | null = null;

async function ensureStage(output: string, layer: number) {
  const key = `${output}:${layer}`;
  if (liveKey === key) return;
  await spresenter.live.apply(output, layer, buildStagePresentation());
  await spresenter.live.setState(output, layer, { show: true });
  liveKey = key;
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMsg;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'init') {
    const outputs = await spresenter.outputs.list();
    spresenter.ui.postMessage({ type: 'outputs', outputs });
    return;
  }

  if (msg.type === 'spin') {
    const output = String(msg.output ?? '0');
    const layer = Number(msg.layer ?? 0);
    await ensureStage(output, layer);
    const html = buildStageHtml({
      style: msg.style,
      candidates: msg.candidates,
      winnerIndex: msg.winnerIndex,
      token: msg.token,
      transparent: msg.transparent,
      title: msg.title,
    });
    spresenter.live.element(output, layer, 'stage').setHtml(html);
    spresenter.ui.postMessage({
      type: 'spun',
      winner: msg.candidates[msg.winnerIndex] ?? '',
    });
    return;
  }

  if (msg.type === 'clear') {
    const output = String(msg.output ?? '0');
    const layer = Number(msg.layer ?? 0);
    await spresenter.live.clear(output, layer);
    liveKey = null;
    spresenter.ui.postMessage({ type: 'cleared' });
  }
};

// eslint-disable-next-line no-console
console.log('Plugin loaded:', spresenter.manifest.name);
