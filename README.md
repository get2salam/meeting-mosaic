# Meeting Mosaic

Turn scattered meeting notes into structured decisions, actions, and follow-ups.

![Meeting Mosaic preview](docs/preview.svg)

Meeting Mosaic is a local-first workspace for founders, operators, and solo builders who want a cleaner way to manage meeting fragments. It keeps clarity, owner, next move, and review timing visible so the right things move forward with less drift.

## What it does

- ranks meeting fragments by leverage, clarity, timing, and friction
- tracks **owner**, **next move**, **follow-up date**, and **clarity** for each meeting fragment
- highlights the best current bet, the next review slot, and the strongest signal on the board
- renders a dedicated queue plus a category mix snapshot beneath the main board
- saves locally in the browser with JSON import/export backups
- quick action: **Queue follow-up**
- quick action: **Sharpen clarity**
- quick action: **Mark closed**

## Why it feels different

Meeting Mosaic is not just a generic list. It is shaped around the real workflow behind meeting fragments, so the board helps you decide what matters next instead of simply storing records.

## Quick start

```bash
git clone https://github.com/get2salam/meeting-mosaic.git
cd meeting-mosaic
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Verify

Meeting Mosaic ships with a small integrity test suite that catches drift between `index.html`, `js/main.js`, and the embedded `SPEC` config. It needs nothing but Node 20+ — no dependencies, no build step.

```bash
npm test
```

The suite confirms every `data-role` / `data-field` / `data-action` attribute in the HTML has a matching reference in `main.js`, that the documented keyboard shortcuts are wired up, and that the `SPEC` states, weights, and seed items stay consistent. CI runs the same checks on Node 20 and 22 through the explicit CI script:

```bash
npm run test:ci
```

The test contract also guards the package scripts and workflow wiring, so local verification and GitHub Actions do not silently drift apart.

## Keyboard shortcuts

- `N` creates a new meeting fragment
- `/` focuses the search box

## How ranking works

Every meeting fragment gets a numeric priority that drives board order and the follow-up queue:

```
priority = score × 6 + clarity × 5 + due-boost + state-weight − friction × 4
```

| Factor | Description | Range |
|--------|-------------|-------|
| Score (Importance) | How much this outcome matters | 1–10 |
| Clarity | How well-understood the next move is | 1–10 |
| Due boost | Extra weight for items due within 4 days | 0–16 |
| State weight | Aligned 8 · Waiting 7 · Closed 3 · Captured 2 | — |
| Friction (Messiness) | Complexity cost subtracted from score | 1–10 |

To surface an item sooner: raise its importance or clarity, reduce friction, or keep its follow-up date current. When two items share the same score, the one with the earlier follow-up date wins.

The `test/scoring.test.mjs` suite verifies each factor in isolation — run it with:

```bash
node --test test/scoring.test.mjs
```

## Validating a backup file

Every export writes a `schema` tag plus the same `category` and `state` values the board uses, but a
hand-edited or scripted backup can drift from that shape. Importing a backup with an unknown category
or state does not fail — `normalize()` in `js/main.js` silently swaps it for the first declared
default, which can quietly change data you meant to keep. Check a file before importing it:

```bash
node scripts/validate-backup.mjs path/to/meeting-mosaic.json
```

It reports every item whose category, state, score, friction, clarity, or follow-up date falls
outside what the board accepts, and warns (without failing) on a `schema` mismatch. Exit code is `0`
when the file is safe to import, `1` when it needs a fix first.

`test/validate-backup.test.mjs` exercises the same checks against known-good and known-bad payloads:

```bash
node --test test/validate-backup.test.mjs
```

## Privacy

Everything stays in your browser unless you export a JSON backup.

## License

MIT
