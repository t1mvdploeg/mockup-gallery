import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGallery } from '../scripts/lib/build.mjs';

const cli = fileURLToPath(new URL('../scripts/gallery.mjs', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mg build '));
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

function project() {
  const root = tmp();
  run('round', '--project', root, '--category', 'Logo', '--authors', 'Opus,Codex');
  const v = path.join(root, 'mockups', 'gallery', 'logo', 'round-1');
  fs.writeFileSync(
    path.join(v, '1A', 'index.html'),
    '<link rel="stylesheet" href="../../../style.css">',
  );
  return { root, v };
}

test('build writes the page and warns about outside references', () => {
  const { root, v } = project();
  const shot = [];
  const { file, warnings } = buildGallery(root, {
    shoot: (h, p) => (shot.push([h, p]), false),
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /1A/);
  assert.equal(file, path.join(root, 'mockups', 'gallery', 'index.html'));
  assert.ok(fs.readFileSync(file, 'utf8').includes('1B'));
  assert.equal(
    fs.readFileSync(path.join(root, 'mockups', 'gallery', '.gitignore'), 'utf8').trim(),
    '.run.json',
  );
  assert.deepEqual(shot, [
    [path.join(v, '1A', 'index.html'), path.join(v, '1A', 'screenshot.png')],
  ]);
});

test('build uses the screenshot the shoot hook made', () => {
  const { root } = project();
  const { file } = buildGallery(root, {
    shoot: (h, p) => (fs.writeFileSync(p, ''), true),
  });
  assert.ok(fs.readFileSync(file, 'utf8').includes('src="logo/round-1/1A/screenshot.png"'));
});

test('corrupt gallery.json throws and is left alone', () => {
  const root = tmp();
  const dir = path.join(root, 'mockups', 'gallery');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gallery.json'), '{oops');
  assert.throws(() => buildGallery(root), /not valid JSON/);
  assert.equal(fs.readFileSync(path.join(dir, 'gallery.json'), 'utf8'), '{oops');
  assert.ok(!fs.existsSync(path.join(dir, 'index.html')));
});

test('cli build prints the path and warnings', () => {
  const { root } = project();
  const lines = run('build', '--project', root).trim().split(/\r?\n/);
  assert.equal(lines[0], path.join(root, 'mockups', 'gallery', 'index.html'));
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^warning: .*1A/);
});
