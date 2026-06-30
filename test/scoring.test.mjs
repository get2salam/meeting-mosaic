import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');

// Far-future date keeps dueBoost at zero so tests are date-independent.
const FAR = '2040-01-01';

function runWithItems(items, uiOverrides = {}) {
  const refs = new Map();
  const documentMock = {
    body: { appendChild() {} },
    createElement() {
      return { className: '', textContent: '', dataset: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, click() {} };
    },
    querySelector(selector) {
      if (!refs.has(selector)) {
        refs.set(selector, { value: '', innerHTML: '', textContent: '', dataset: {}, focus() {}, click() {} });
      }
      return refs.get(selector);
    },
    addEventListener() {},
  };

  const storedState = {
    items,
    ui: { search: '', category: 'all', status: 'all', selectedId: items[0]?.id ?? null, ...uiOverrides },
  };

  vm.runInNewContext(JS, {
    Blob: class { constructor(parts) { this.parts = parts; } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    console,
    document: documentMock,
    localStorage: { getItem: () => JSON.stringify(storedState), setItem() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    requestAnimationFrame: (cb) => cb(),
    setTimeout: (cb) => { cb(); return 0; },
    window: { prompt() {} },
  }, { filename: 'js/main.js' });

  return refs;
}

// Returns item titles in rendered board order (highest priority first).
function titlesInOrder(refs) {
  const html = refs.get('[data-role="list"]').innerHTML;
  return [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
}

function item(overrides) {
  return { id: 'x', title: 'item', category: 'Action', state: 'Captured', score: 7, effort: 3, metric: 6, textOne: 'Owner', textTwo: 'Next', date: FAR, note: 'note', ...overrides };
}

test('higher score item ranks first when other factors are equal', () => {
  // priority(score=9) = 9×6 + 6×5 + 0 + 2 − 3×4 = 74
  // priority(score=5) = 5×6 + 6×5 + 0 + 2 − 3×4 = 50
  const refs = runWithItems([
    item({ id: 'lo', title: 'Low score item', score: 5 }),
    item({ id: 'hi', title: 'High score item', score: 9 }),
  ]);
  const [first, second] = titlesInOrder(refs);
  assert.equal(first, 'High score item');
  assert.equal(second, 'Low score item');
});

test('Aligned state ranks above Captured when score and metric match', () => {
  // Aligned weight = 8; Captured weight = 2 → 6-point gap
  const refs = runWithItems([
    item({ id: 'cap', title: 'Captured item', state: 'Captured' }),
    item({ id: 'ali', title: 'Aligned item', state: 'Aligned' }),
  ]);
  const [first, second] = titlesInOrder(refs);
  assert.equal(first, 'Aligned item');
  assert.equal(second, 'Captured item');
});

test('lower friction item ranks above higher friction item when otherwise equal', () => {
  // effort penalty = effort × 4; clean(2) vs messy(8) → 24-point gap
  const refs = runWithItems([
    item({ id: 'messy', title: 'Messy item', effort: 8 }),
    item({ id: 'clean', title: 'Clean item', effort: 2 }),
  ]);
  const [first, second] = titlesInOrder(refs);
  assert.equal(first, 'Clean item');
  assert.equal(second, 'Messy item');
});

test('earlier follow-up date wins when two items share the same priority score', () => {
  // Both items have identical scores; date tiebreaker should apply.
  const refs = runWithItems([
    item({ id: 'late', title: 'Late item', date: '2040-06-01' }),
    item({ id: 'soon', title: 'Soon item', date: '2040-01-01' }),
  ]);
  const [first, second] = titlesInOrder(refs);
  assert.equal(first, 'Soon item');
  assert.equal(second, 'Late item');
});

test('category filter hides items that do not match', () => {
  const refs = runWithItems([
    item({ id: 'a', title: 'Action item', category: 'Action' }),
    item({ id: 'r', title: 'Risk item', category: 'Risk' }),
    item({ id: 'd', title: 'Decision item', category: 'Decision' }),
  ], { category: 'Action', selectedId: 'a' });
  const titles = titlesInOrder(refs);
  assert.equal(titles.length, 1, 'only one item should pass the category filter');
  assert.equal(titles[0], 'Action item');
});

test('search filter matches title text case-insensitively', () => {
  const refs = runWithItems([
    item({ id: 'p', title: 'Pricing decision', category: 'Decision' }),
    item({ id: 'v', title: 'Vendor risk', category: 'Risk' }),
  ], { search: 'pricing', selectedId: 'p' });
  const titles = titlesInOrder(refs);
  assert.equal(titles.length, 1, 'search should narrow to one matching item');
  assert.equal(titles[0], 'Pricing decision');
});
