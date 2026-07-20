# Raffle — Spresenter plugin

Draws a random winner from a list of names or a numeric range and reveals the
result **live** on an output, with an animated wheel or slot-machine reel.

## Modes

- **Name list** — one name per line (blank lines and surrounding whitespace are
  ignored).
- **Numeric range** — inclusive integer minimum and maximum.

## Animations

- **🎡 Wheel** — a spinning wheel of colored sectors that decelerates and stops
  with the pointer over the winner. With many participants (> 60) the wheel
  shows a representative sample (always including the winner) so it stays
  legible.
- **🎰 Vertical** — a slot-machine reel: the column accelerates, slows down, and
  stops with the winner in the center slot.

## How it works

Like Figma plugins, this runs in **two isolated threads** that talk over
`postMessage`:

```
┌─────────────────────┐   postMessage    ┌──────────────────────┐   spresenter.*   ┌───────────┐
│  UI panel (iframe)   │ ───────────────► │  logic thread        │ ───────────────► │ Spresenter │
│  src/ui/App.tsx      │ ◄─────────────── │  src/code.ts         │ ◄─────────────── │  cores     │
└─────────────────────┘                  └──────────────────────┘                  └───────────┘
```

1. **The UI panel (`src/ui/`) picks the winner.** The browser RNG chooses a
   `winnerIndex`, and the panel sends `{ style, candidates, winnerIndex, token }`
   to the logic thread. It renders the same animation inline as a live preview.
2. **The logic thread (`src/code.ts`) drives the output.** On the first draw for
   an `output:layer` it applies a full-screen stage presentation (a single
   `stage` rectangle element) once, then pushes the animated HTML into that
   element via `spresenter.live.element(output, layer, 'stage').setHtml(html)`.
   No per-frame IPC — the animation is pure CSS.
3. **The HTML is deterministic.** `buildStageHtml({ style, candidates,
   winnerIndex, token })` derives all shuffling and jitter from a hash of
   `token`, so the panel preview and the live output are pixel-identical.

The animation is 100% CSS (`@keyframes`) inside a self-contained HTML block, so
it plays back smoothly on the output with no runtime dependency on the plugin
process.

### Message protocol (UI ↔ logic)

| Direction   | Message | Effect |
|-------------|---------|--------|
| UI → logic  | `{ type: 'init' }` | Logic replies with `{ type: 'outputs', outputs }`. |
| UI → logic  | `{ type: 'spin', output, layer, style, candidates, winnerIndex, token, transparent?, title? }` | Applies the stage (once) and pushes the animated HTML; replies `{ type: 'spun', winner }`. |
| UI → logic  | `{ type: 'clear', output, layer }` | Clears the layer; replies `{ type: 'cleared' }`. |

## Files

| Path | Role |
|------|------|
| `src/shared/raffle.ts` | Pure core — name parsing, range expansion, deterministic HTML generation. Exports `parseNames`, `rangeCandidates`, `buildStageHtml`, and the `RaffleMode` / `RaffleStyle` types. |
| `src/code.ts` | Logic thread — applies the stage presentation and pushes live HTML in response to UI messages. |
| `src/ui/App.tsx` | Control panel (React) with a live preview. |
| `manifest.json` | Plugin metadata, permissions and panel definition. |

## Permissions

Declared in `manifest.json`:

- `outputs:read` — list the available outputs to target.
- `live:write` — apply the stage and push live content.

## Build

```bash
npm install      # uses the vendored SDK at sdk/spresenter-plugin-sdk.tgz
npm run build    # emits dist/code.js (IIFE) + dist/ui/
```

## Package for distribution

```bash
npm run package  # builds, then writes release/com.spresenter.raffle-<version>.zip
```

The archive contains only what the installer needs — `manifest.json` at the
root plus the built `dist/` (and this README). Install it via
**Settings → Plugins → Install (.zip/folder)**.

## Develop

Point **Settings → Plugins → Load folder (dev)** at this folder and run:

```bash
npm run dev      # rebuilds code + UI on change (hot reload)
```
