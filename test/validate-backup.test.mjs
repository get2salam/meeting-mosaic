import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadSpec, validateBackup } from '../scripts/validate-backup.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = loadSpec(readFileSync(resolve(ROOT, 'js/main.js'), 'utf8'));

function backupItem(overrides) {
  return {
    title: 'Sample fragment',
    category: 'Decision',
    state: 'Aligned',
    score: 7,
    effort: 3,
    metric: 6,
    date: '2026-05-01',
    ...overrides,
  };
}

test('a well-formed backup produces no errors or warnings', () => {
  const payload = { schema: `${SPEC.slug}/v3`, items: [backupItem()] };
  const { errors, warnings } = validateBackup(payload, SPEC);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('an undeclared category is reported as an error, not silently accepted', () => {
  const payload = { schema: `${SPEC.slug}/v3`, items: [backupItem({ category: 'Rumor' })] };
  const { errors } = validateBackup(payload, SPEC);
  assert.ok(errors.some((message) => message.includes('category') && message.includes('Rumor')));
});

test('an undeclared state is reported as an error', () => {
  const payload = { schema: `${SPEC.slug}/v3`, items: [backupItem({ state: 'Archived' })] };
  const { errors } = validateBackup(payload, SPEC);
  assert.ok(errors.some((message) => message.includes('state') && message.includes('Archived')));
});

test('an out-of-range score is reported as an error', () => {
  const payload = { schema: `${SPEC.slug}/v3`, items: [backupItem({ score: 42 })] };
  const { errors } = validateBackup(payload, SPEC);
  assert.ok(errors.some((message) => message.includes('score')));
});

test('a malformed date is reported as an error', () => {
  const payload = { schema: `${SPEC.slug}/v3`, items: [backupItem({ date: '05/01/2026' })] };
  const { errors } = validateBackup(payload, SPEC);
  assert.ok(errors.some((message) => message.includes('date')));
});

test('a mismatched schema is a warning, not an error, since the app still imports it', () => {
  const payload = { schema: 'other-app/v1', items: [backupItem()] };
  const { errors, warnings } = validateBackup(payload, SPEC);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((message) => message.includes('schema')));
});

test('a missing "items" array is a fatal error', () => {
  const payload = { schema: `${SPEC.slug}/v3` };
  const { errors } = validateBackup(payload, SPEC);
  assert.ok(errors.some((message) => message.includes('items')));
});
