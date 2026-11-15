import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { slugify, loadManifest, addRound } from '../scripts/lib/manifest.mjs';

const cli = fileURLToPath(new URL('../scripts/gallery.mjs', import.meta.url));
const now = new Date('2026-11-15T10:00:00Z');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mg-'));
const empty = () => ({ version: 1, project: 'Acme', categories: [] });

test('slugify', () => {
  assert.equal(slugify('🎨 App Icons!'), 'app-icons');
  assert.equal(slugify('!!!'), 'category');
});

test('addRound on empty manifest', () => {
  const m = empty();
  const { round, categorySlug } = addRound(m, {
    category: 'Logo',
    note: 'n',
    authors: ['a', 'b'],
    now,
  });
  assert.equal(categorySlug, 'logo');
  assert.equal(round.n, 1);
  assert.deepEqual(
    round.variants.map((v) => v.label),
    ['1A', '1B'],
  );
  assert.equal(round.created, now.toISOString());
});

test('second round and case-insensitive category match', () => {
  const m = empty();
  addRound(m, { category: 'Logo', note: '', authors: ['a'], now });
  const { round } = addRound(m, { category: 'logo', note: '', authors: ['a', 'b'], now });
  assert.equal(round.n, 2);
  assert.equal(round.variants[0].label, '2A');
  assert.equal(m.categories.length, 1);
  assert.equal(m.categories[0].name, 'Logo');
});

test('too many authors', () => {
  const authors = Array.from({ length: 27 }, (_, i) => `a${i}`);
  assert.throws(
    () => addRound(empty(), { category: 'x', note: '', authors, now }),
    /at most 26 variants/,
  );
});

test('loadManifest', () => {
  const d = tmp();
  assert.deepEqual(loadManifest(d).categories, []);
  fs.writeFileSync(path.join(d, 'gallery.json'), '{oops');
  assert.throws(() => loadManifest(d), /not valid JSON/);
});

test('cli round', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg proj '));
  const out = execFileSync(process.execPath, [
    cli,
    'round',
    '--project',
    root,
    '--category',
    'Logo',
    '--note',
    'first',
    '--authors',
    'A,B',
  ]);
  const res = JSON.parse(out);
  assert.deepEqual(res.labels, ['1A', '1B']);
  for (const l of ['1A', '1B']) {
    assert.ok(fs.existsSync(path.join(root, 'mockups', 'gallery', 'logo', 'round-1', l)));
  }
});

test('loadManifest rejects path-traversal fields and accepts a valid manifest', () => {
  const dir = tmp();
  const write = (slug, label) =>
    fs.writeFileSync(
      path.join(dir, 'gallery.json'),
      JSON.stringify({
        categories: [{ slug, rounds: [{ n: 1, variants: [{ label }] }] }],
      }),
    );
  write('logo', '1A');
  assert.equal(loadManifest(dir).categories[0].slug, 'logo');
  write('../x', '1A');
  assert.throws(() => loadManifest(dir), /invalid category slug/);
  write('logo', '1A/../../x');
  assert.throws(() => loadManifest(dir), /invalid variant label/);
  write('logo', '2A');
  assert.throws(() => loadManifest(dir), /invalid variant label/);
});
