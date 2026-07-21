import { useEffect, useMemo, useRef, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import {
  Root,
  Header,
  Panel,
  Row,
  Field,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  Button,
  Actions,
  Segmented,
  Hint,
} from '@spresenter/plugin-sdk/ui-kit/react';
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

  return (
    <Root>
      <Header
        title="Raffle"
        subtitle="Draw from a numeric range or a name list, with an animated wheel or vertical reel."
      />

      {/* Target */}
      <Row>
        <Field label="Output">
          <Select value={output} onChange={(e) => setOutput(e.target.value)}>
            {outputs.map((o) => (
              <option key={o.index} value={o.index}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Layer" grow={0} style={{ width: 96 }}>
          <TextInput
            type="number"
            min={0}
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
          />
        </Field>
      </Row>

      {/* Mode */}
      <Panel label="Mode">
        <Segmented<RaffleMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'names', label: 'Name list' },
            { value: 'range', label: 'Numeric range' },
          ]}
        />

        {mode === 'names' ? (
          <Field label="Names (one per line)">
            <TextArea
              mono
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={6}
            />
          </Field>
        ) : (
          <Row>
            <Field label="Minimum">
              <TextInput
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
            </Field>
            <Field label="Maximum">
              <TextInput
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
              />
            </Field>
          </Row>
        )}

        <Hint>
          {rangeInvalid ? (
            <span style={{ color: 'var(--sp-warning)' }}>
              Maximum must be greater than or equal to minimum.
            </span>
          ) : (
            <>
              {count} participant{count === 1 ? '' : 's'}
              {style === 'wheel' && count > 60 && (
                <span style={{ color: 'var(--sp-warning)' }}>
                  {' '}
                  — the wheel shows a sample; vertical is better for large sets.
                </span>
              )}
            </>
          )}
        </Hint>
      </Panel>

      {/* Style + options */}
      <Panel label="Animation">
        <Segmented<RaffleStyle>
          value={style}
          onChange={setStyle}
          options={[
            { value: 'wheel', label: '🎡 Wheel' },
            { value: 'vertical', label: '🎰 Vertical' },
          ]}
        />
        <Field label="Title (optional)">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Checkbox
          label="Transparent background (overlay the layer below)"
          checked={transparent}
          onChange={(e) => setTransparent(e.target.checked)}
        />
      </Panel>

      {/* Preview */}
      <div
        style={{
          borderRadius: 'var(--sp-radius-lg)',
          background: '#000',
          overflow: 'hidden',
          aspectRatio: '16 / 9',
          border: '1px solid var(--sp-border)',
        }}
      >
        {preview ? (
          <iframe
            key={preview.token}
            title="preview"
            srcDoc={`<!doctype html><html><body style="margin:0">${preview.html}</body></html>`}
            style={{ width: '100%', height: '100%', border: 0 }}
            sandbox="allow-scripts"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sp-text-faint)',
              fontSize: 13,
            }}
          >
            Raffle preview
          </div>
        )}
      </div>

      {winner !== null && (
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          Result:{' '}
          <span style={{ fontWeight: 600, color: 'var(--sp-warning)' }}>
            {winner}
          </span>
        </div>
      )}

      {/* Actions */}
      <Actions>
        <Button onClick={() => draw(false)} disabled={!canDraw}>
          Test preview
        </Button>
        <Button variant="success" onClick={() => draw(true)} disabled={!canDraw}>
          Draw live
        </Button>
        {isLive && (
          <>
            <Actions.Spacer />
            <Button onClick={clear}>Clear</Button>
          </>
        )}
      </Actions>
    </Root>
  );
}
