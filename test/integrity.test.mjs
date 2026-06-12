import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const JS = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');

function attrValues(source, attr) {
  const found = new Set();
  const pattern = new RegExp(`\\b${attr}="([^"]+)"`, 'g');
  for (const match of source.matchAll(pattern)) found.add(match[1]);
  return [...found];
}

function loadSpec() {
  const match = JS.match(/const SPEC = (\{[\s\S]+?\n\});\nconst STORAGE_KEY/);
  assert.ok(match, 'could not locate const SPEC = {...} block in js/main.js');
  return JSON.parse(match[1]);
}

test('every data-role rendered in index.html is queried by main.js', () => {
  const roles = attrValues(HTML, 'data-role');
  assert.ok(roles.length, 'expected at least one data-role in index.html');
  for (const value of roles) {
    assert.ok(
      JS.includes(`[data-role="${value}"]`),
      `data-role="${value}" is rendered in index.html but never queried in main.js`,
    );
  }
});

test('every data-field rendered in index.html is queried by main.js', () => {
  const fields = attrValues(HTML, 'data-field');
  assert.ok(fields.length, 'expected at least one data-field in index.html');
  for (const value of fields) {
    assert.ok(
      JS.includes(`[data-field="${value}"]`),
      `data-field="${value}" is rendered in index.html but never queried in main.js`,
    );
  }
});

test('every data-action button in index.html has a handler branch in main.js', () => {
  const actions = attrValues(HTML, 'data-action');
  assert.ok(actions.length, 'expected at least one data-action in index.html');
  for (const value of actions) {
    assert.ok(
      JS.includes(`'${value}'`) || JS.includes(`"${value}"`),
      `data-action="${value}" has no matching string literal handler in main.js`,
    );
  }
});

test('keyboard shortcuts documented in README have handlers in main.js', () => {
  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  for (const key of ['N', '/']) {
    assert.ok(readme.includes(`\`${key}\``), `README does not document the \`${key}\` shortcut`);
  }
  assert.match(JS, /event\.key\.toLowerCase\(\)\s*===\s*'n'/);
  assert.match(JS, /event\.key\s*===\s*'\/'/);
});

test('SPEC.completedStates is a subset of SPEC.states', () => {
  const spec = loadSpec();
  for (const state of spec.completedStates ?? []) {
    assert.ok(spec.states.includes(state), `completed state "${state}" is not declared in SPEC.states`);
  }
});

test('every SPEC.state has a numeric weight in SPEC.stateWeights', () => {
  const spec = loadSpec();
  for (const state of spec.states) {
    assert.ok(state in spec.stateWeights, `state "${state}" is missing from SPEC.stateWeights`);
    assert.equal(typeof spec.stateWeights[state], 'number', `weight for "${state}" must be numeric`);
  }
});

test('every seeded SPEC.item uses a declared category and state', () => {
  const spec = loadSpec();
  for (const item of spec.items) {
    assert.ok(spec.categories.includes(item.category), `item "${item.title}" uses undeclared category "${item.category}"`);
    assert.ok(spec.states.includes(item.state), `item "${item.title}" uses undeclared state "${item.state}"`);
  }
});

test('SPEC.metric default falls within the declared min/max range', () => {
  const { metric } = loadSpec();
  assert.ok(metric.default >= metric.min && metric.default <= metric.max,
    `metric default ${metric.default} is outside [${metric.min}, ${metric.max}]`);
});

test('user-controlled item fields are escaped before innerHTML rendering', () => {
  assert.match(JS, /function safeText\(value\) \{/,
    'expected a dedicated text escaping helper for HTML template rendering');

  const unsafeTemplateSnippets = [
    'data-id="${item.id}"',
    '>${item.title}<',
    '>${item.note}<',
    '>${item.textOne}<',
    '${item.textOne} · ${item.textTwo}',
    '${SPEC.textTwo.label}: ${item.textTwo}',
    '>${item.category}<',
    '>${item.state}<',
    'value="${item.date}"',
    '>${strongest}<',
  ];

  for (const snippet of unsafeTemplateSnippets) {
    assert.ok(!JS.includes(snippet),
      `${snippet} should be escaped before it is interpolated into innerHTML`);
  }

  for (const field of ['id', 'title', 'note', 'textOne', 'textTwo']) {
    assert.ok(JS.includes(`safeText(item.${field})`),
      `expected item.${field} to be rendered through safeText()`);
  }
});
