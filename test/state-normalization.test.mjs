import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');

function runAppWithStoredState(storedState) {
  const refs = new Map();
  const documentMock = {
    body: { appendChild() {} },
    createElement(tag) {
      return {
        tag,
        className: '',
        textContent: '',
        dataset: {},
        classList: { add() {}, remove() {} },
        appendChild() {},
        remove() {},
        click() {},
      };
    },
    querySelector(selector) {
      if (!refs.has(selector)) {
        refs.set(selector, { value: '', innerHTML: '', textContent: '', dataset: {}, focus() {}, click() {} });
      }
      return refs.get(selector);
    },
    addEventListener() {},
  };

  const context = {
    Blob: class Blob { constructor(parts, options) { this.parts = parts; this.options = options; } },
    URL: { createObjectURL: () => 'blob:meeting-mosaic', revokeObjectURL() {} },
    console,
    document: documentMock,
    localStorage: { getItem: () => JSON.stringify(storedState), setItem() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => { callback(); return 0; },
    window: { prompt() {} },
  };

  vm.runInNewContext(JS, context, { filename: 'js/main.js' });
  return refs;
}

test('imported backups with malformed numeric fields render with safe defaults', () => {
  const refs = runAppWithStoredState({
    items: [{
      id: 'imported-bad-numbers',
      title: 'Messy imported follow-up',
      category: 'Follow-up',
      state: 'Waiting',
      score: 'urgent',
      effort: 'unknown',
      metric: 'clear enough',
      textOne: 'Ops lead',
      textTwo: 'Send summary',
      date: '2026-05-01',
      note: 'A hand-edited backup should not poison priority math.',
    }],
    ui: { search: '', category: 'all', status: 'all', selectedId: 'imported-bad-numbers' },
  });

  const rendered = [
    refs.get('[data-role="list"]').innerHTML,
    refs.get('[data-role="editor"]').innerHTML,
    refs.get('[data-role="stats"]').innerHTML,
    refs.get('[data-role="insights"]').innerHTML,
  ].join('\n');

  assert.doesNotMatch(rendered, /NaN/, 'malformed imported numbers should not surface NaN in the UI');
  assert.match(rendered, /Importance[\s\S]+value="7"/, 'invalid imported importance should use the board default');
  assert.match(rendered, /Friction 3\/10/, 'invalid imported messiness should use the board default');
  assert.match(rendered, /Clarity 6\/10/, 'invalid imported clarity should use the configured metric default');
});