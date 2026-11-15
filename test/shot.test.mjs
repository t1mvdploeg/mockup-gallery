import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser, screenshot } from '../scripts/lib/shot.mjs';
import { buildGallery } from '../scripts/lib/build.mjs';

const cli = fileURLToPath(new URL('../scripts/gallery.mjs', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mg shot '));
const isPng = (f) =>
  fs
    .readFileSync(f)
    .subarray(0, 4)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

test('findBrowser prefers the env override', () => {
  assert.equal(findBrowser({ MOCKUP_GALLERY_BROWSER: '/nope' }), '/nope');
});

test('screenshot returns false without a working browser', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>x</h1>');
  assert.equal(screenshot(path.join(dir, 'index.html'), path.join(dir, 's.png'), '/nope'), false);
  assert.equal(screenshot(path.join(dir, 'index.html'), path.join(dir, 's.png'), null), false);
});

test('screenshot makes a PNG in a folder with a space', (t) => {
  if (!findBrowser()) return t.skip('no browser');
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hello</h1>');
  const png = path.join(dir, 's.png');
  assert.equal(screenshot(path.join(dir, 'index.html'), png), true);
  assert.ok(isPng(png));
});

test('build screenshots a variant with only index.html', (t) => {
  if (!findBrowser()) return t.skip('no browser');
  const root = tmp();
  execFileSync(
    process.execPath,
    [cli, 'round', '--project', root, '--category', 'Logo', '--authors', 'Opus'],
    {
      encoding: 'utf8',
    },
  );
  const v = path.join(root, 'mockups', 'gallery', 'logo', 'round-1', '1A');
  fs.writeFileSync(path.join(v, 'index.html'), '<h1>hi</h1>');
  buildGallery(root);
  assert.ok(isPng(path.join(v, 'screenshot.png')));
});
