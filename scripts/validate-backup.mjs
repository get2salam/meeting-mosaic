#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function loadSpec(jsSource) {
  const match = jsSource.match(/const SPEC = (\{[\s\S]+?\n\});\nconst STORAGE_KEY/);
  if (!match) throw new Error('could not locate const SPEC = {...} block in js/main.js');
  return JSON.parse(match[1]);
}

// Mirrors normalize() in js/main.js: an unknown category/state does not fail import,
// it silently falls back to the first declared option. That's the case this catches.
export function validateBackup(payload, spec) {
  const errors = [];
  const warnings = [];

  if (typeof payload !== 'object' || payload === null) {
    errors.push('backup root must be a JSON object');
    return { errors, warnings };
  }

  const expectedSchema = `${spec.slug}/v3`;
  if (payload.schema !== expectedSchema) {
    warnings.push(`schema is "${payload.schema ?? 'missing'}", expected "${expectedSchema}" — the app will still import it, but items may predate this SPEC version`);
  }

  if (!Array.isArray(payload.items)) {
    errors.push('"items" must be an array');
    return { errors, warnings };
  }

  payload.items.forEach((item, index) => {
    const label = `items[${index}]${item?.title ? ` ("${item.title}")` : ''}`;

    if (!item.title || typeof item.title !== 'string') {
      warnings.push(`${label}: missing "title" — will be replaced with a placeholder on import`);
    }
    if (!spec.categories.includes(item.category)) {
      errors.push(`${label}: category "${item.category}" is not one of ${spec.categories.join(', ')} — it will silently fall back to "${spec.categories[0]}"`);
    }
    if (!spec.states.includes(item.state)) {
      errors.push(`${label}: state "${item.state}" is not one of ${spec.states.join(', ')} — it will silently fall back to "${spec.states[0]}"`);
    }
    for (const [field, min, max] of [['score', 1, 10], ['effort', 1, 10], ['metric', spec.metric.min, spec.metric.max]]) {
      const value = Number(item[field]);
      if (!Number.isFinite(value) || value < min || value > max) {
        errors.push(`${label}: ${field} "${item[field]}" is outside the expected range [${min}, ${max}]`);
      }
    }
    if (item.date && !DATE_PATTERN.test(item.date)) {
      errors.push(`${label}: date "${item.date}" is not in YYYY-MM-DD format`);
    }
  });

  return { errors, warnings };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/validate-backup.mjs <path-to-backup.json>');
    process.exitCode = 1;
    return;
  }

  const spec = loadSpec(readFileSync(resolve(ROOT, 'js/main.js'), 'utf8'));
  let payload;
  try {
    payload = JSON.parse(readFileSync(resolve(file), 'utf8'));
  } catch (error) {
    console.error(`Could not parse ${file} as JSON: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { errors, warnings } = validateBackup(payload, spec);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);

  const itemCount = Array.isArray(payload.items) ? payload.items.length : 0;
  console.log(`Checked ${itemCount} item(s) in ${file}: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exitCode = errors.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
