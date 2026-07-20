import { useEffect, useMemo, useRef, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import {
  buildStageHtml,
  parseNames,
  rangeCandidates,
  type RaffleMode,
  type RaffleStyle,
} from '../shared/raffle';

interface Output {
  index: number;
  name: string;
}

function makeToken(): string {
  return (
    Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36)
  );
}

export function App() {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [output, setOutput] = useState('0');
  const [layer, setLayer] = useState(0);

  const [mode, setMode] = useState<RaffleMode>('names');
  const [style, setStyle] = useState<RaffleStyle>('wheel');
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [names, setNames] = useState('Ana\nBruno\nCarla\nDavi\nEva\nFabio');
  const [title, setTitle] = useState('Raffle');
  const [transparent, setTransparent] = useState(false);

  const [preview, setPreview] = useState<{ html: string; token: string } | null>(
    null,
  );
  const [winner, setWinner] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const previewSeq = useRef(0);

  useEffect(() => {
    const off = onMessage((raw) => {
      const msg = raw as { type?: string; outputs?: Output[]; winner?: string };
      if (msg.type === 'outputs') {
        setOutputs(msg.outputs ?? []);
        if (msg.outputs?.[0]) setOutput(String(msg.outputs[0].index));
      }
      if (msg.type === 'spun') {
        setWinner(msg.winner ?? '');
        setIsLive(true);
      }
      if (msg.type === 'cleared') setIsLive(false);
    });
    postMessage({ type: 'init' });
    return off;
  }, []);

  const candidates = useMemo(
    () => (mode === 'range' ? rangeCandidates(min, max) : parseNames(names)),
    [mode, min, max, names],
  );

  const count = candidates.length;
  const rangeInvalid = mode === 'range' && Math.floor(max) < Math.floor(min);
  const canDraw = count > 0 && !rangeInvalid;

  // Draw: pick the winner (RNG here, in the browser), build the preview and —
  // if going live — send the SAME params for the logic thread to reproduce it.
  const draw = (live: boolean) => {
    if (!canDraw) return;
    const winnerIndex = Math.floor(Math.random() * count);
    const token = makeToken();
    previewSeq.current += 1;
    const html = buildStageHtml({
      style,
      candidates,
      winnerIndex,
      token,
      transparent,
      title: title.trim() || undefined,
    });
    setPreview({ html, token });
    setWinner(candidates[winnerIndex]);
    if (live) {
      postMessage({
        type: 'spin',
        output,
        layer,
        style,
        candidates,
        winnerIndex,
        token,
        transparent,
        title: title.trim() || undefined,
      });
    }
  };

  const clear = () => {
    postMessage({ type: 'clear', output, layer });
    setPreview(null);
    setWinner(null);
  };

  const inputCls =
    'rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 flex flex-col gap-3">
      <header>
        <h1 className="text-lg font-semibold">Raffle</h1>
        <p className="text-sm text-neutral-400">
          Draw from a numeric range or a name list, with an animated wheel or
          vertical reel.
        </p>
      </header>

      {/* Target */}
      <div className="flex gap-2">
        <label className="flex flex-col text-xs text-neutral-400 flex-1">
          Output
          <select
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            className={`mt-1 ${inputCls}`}
          >
            {outputs.map((o) => (
              <option key={o.index} value={o.index}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-neutral-400 w-24">
          Layer
          <input
            type="number"
            min={0}
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
            className={`mt-1 ${inputCls}`}
          />
        </label>
      </div>

      {/* Mode */}
      <div className="flex flex-col gap-2 rounded-lg bg-neutral-800/50 p-3">
        <span className="text-xs font-medium text-neutral-300">Mode</span>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('names')}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              mode === 'names'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Name list
          </button>
          <button
            onClick={() => setMode('range')}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              mode === 'range'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Numeric range
          </button>
        </div>

        {mode === 'names' ? (
          <label className="flex flex-col text-xs text-neutral-400 mt-1">
            Names (one per line)
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={6}
              className={`mt-1 resize-y font-mono ${inputCls}`}
            />
          </label>
        ) : (
          <div className="flex gap-2 mt-1">
            <label className="flex flex-col text-xs text-neutral-400 flex-1">
              Minimum
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="flex flex-col text-xs text-neutral-400 flex-1">
              Maximum
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>
        )}

        <div className="text-xs text-neutral-500">
          {rangeInvalid ? (
            <span className="text-amber-400">
              Maximum must be greater than or equal to minimum.
            </span>
          ) : (
            <>
              {count} participant{count === 1 ? '' : 's'}
              {style === 'wheel' && count > 60 && (
                <span className="text-amber-400">
                  {' '}
                  — the wheel shows a sample; vertical is better for large sets.
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Style + options */}
      <div className="flex flex-col gap-2 rounded-lg bg-neutral-800/50 p-3">
        <span className="text-xs font-medium text-neutral-300">Animation</span>
        <div className="flex gap-2">
          <button
            onClick={() => setStyle('wheel')}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              style === 'wheel'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            🎡 Wheel
          </button>
          <button
            onClick={() => setStyle('vertical')}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              style === 'vertical'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            🎰 Vertical
          </button>
        </div>
        <label className="flex flex-col text-xs text-neutral-400 mt-1">
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />
          Transparent background (overlay the layer below)
        </label>
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-black overflow-hidden aspect-video border border-neutral-800">
        {preview ? (
          <iframe
            key={preview.token}
            title="preview"
            srcDoc={`<!doctype html><html><body style="margin:0">${preview.html}</body></html>`}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-neutral-600">
            Raffle preview
          </div>
        )}
      </div>

      {winner !== null && (
        <div className="text-center text-sm">
          Result:{' '}
          <span className="font-semibold text-amber-400">{winner}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => draw(false)}
          disabled={!canDraw}
          className="rounded bg-neutral-700 hover:bg-neutral-600 px-4 py-2 text-sm disabled:opacity-40"
        >
          Test preview
        </button>
        <button
          onClick={() => draw(true)}
          disabled={!canDraw}
          className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Draw live
        </button>
        {isLive && (
          <button
            onClick={clear}
            className="ml-auto rounded bg-neutral-700 hover:bg-neutral-600 px-4 py-2 text-sm"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
