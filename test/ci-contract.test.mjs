import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const CI_WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
const README = readFileSync(resolve(ROOT, 'README.md'), 'utf8');

function script(name) {
  const value = PACKAGE_JSON.scripts?.[name];
  assert.equal(typeof value, 'string', `package.json is missing the ${name} script`);
  return value;
}

test('npm test runs the full local test suite without quoted node --test globs', () => {
  const testScript = script('test');

  assert.equal(testScript, 'node --test test/*.test.mjs');
  assert.ok(!/node --test\s+['"]/.test(testScript), 'node --test globs should stay unquoted for CI guard compatibility');
});

test('CI uses the dedicated package script instead of an inline test command', () => {
  assert.match(CI_WORKFLOW, /node-version:\s*\[20, 22\]/, 'CI should keep exercising the supported Node matrix');
  assert.match(CI_WORKFLOW, /run:\s*npm run test:ci/, 'CI should call the package-level CI test script');
  assert.equal(script('test:ci'), 'npm test');
});

test('README documents both local and CI verification commands', () => {
  assert.match(README, /npm test/, 'README should document the local verification command');
  assert.match(README, /npm run test:ci/, 'README should document the CI-equivalent verification command');
});
