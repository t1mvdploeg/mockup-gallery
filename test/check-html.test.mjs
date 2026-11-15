import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { findOutsideRefs } from '../scripts/lib/check-html.mjs';

const dir = path.resolve('gallery', 'logo', 'round-1', '1A');
const file = path.join(dir, 'index.html');

test('reports references outside the variant folder', () => {
  const html = `<link href="../../shared.css"><img src="C:/x.png">
    <div style="background:url('/abs.png')"></div>`;
  assert.deepEqual(findOutsideRefs(html, file, dir), ['../../shared.css', 'C:/x.png', '/abs.png']);
});

test('ignores local files, web links, data and anchors', () => {
  const html = `<img src="logo.svg"><img src='img/a.png?v=1'><a href="https://example.com">x</a>
    <img src="data:image/png;base64,AAAA"><a href="#top">top</a><a href="mailto:a@example.com">m</a>
    <style>body{background:url(bg.png)}</style>`;
  assert.deepEqual(findOutsideRefs(html, file, dir), []);
});
