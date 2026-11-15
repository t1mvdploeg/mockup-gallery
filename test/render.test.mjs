import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGallery } from '../scripts/lib/render.mjs';

const now = new Date('2026-11-15T22:40:00Z');
const ago = (h) => new Date(now - h * 3600e3).toISOString();

const manifest = {
  version: 1,
  project: 'Acme',
  categories: [
    {
      name: 'Logo',
      slug: 'logo',
      rounds: [
        { n: 1, note: 'first try', created: ago(48), variants: [{ label: '1A', author: 'Opus' }] },
        {
          n: 2,
          note: 'bolder',
          created: ago(1),
          variants: [
            { label: '2A', author: 'Opus' },
            { label: '2B', author: 'Codex' },
          ],
        },
      ],
    },
    {
      name: '<b>&"Icons"',
      slug: 'b-icons',
      rounds: [{ n: 1, note: '', created: ago(72), variants: [{ label: '1A', author: 'Opus' }] }],
    },
  ],
};

const files = new Map([
  ['logo/round-1/1A', { image: true, html: false }],
  ['logo/round-2/2A', { image: true, html: true }],
  ['logo/round-2/2B', { image: false, html: false }],
  ['b-icons/round-1/1A', { image: true, html: false }],
]);

const html = renderGallery(manifest, files, { now, timeZone: 'UTC' });

test('sidebar lists categories with round counts', () => {
  assert.match(html, /<nav[^]*>Logo<[^]*?class="count">2<[^]*<\/nav>/);
});

test('newest round first, one NEW badge', () => {
  assert.ok(html.indexOf('Round 2') < html.indexOf('Round 1'));
  assert.equal(html.split('>NEW<').length - 1, 1);
});

test('without JS every category is visible', () => {
  assert.ok(!/<section[^>]*\bhidden\b/.test(html));
});

test('names are escaped', () => {
  assert.ok(html.includes('&lt;b&gt;&amp;&quot;Icons&quot;'));
  assert.ok(!html.includes('<b>&"Icons"'));
});

test('variants: label, html link, placeholder', () => {
  assert.ok(html.includes('2A'));
  assert.ok(html.includes('href="logo/round-2/2A/index.html"'));
  assert.ok(html.includes('src="logo/round-2/2A/screenshot.png"'));
  assert.ok(html.includes('href="logo/round-1/1A/screenshot.png"'));
  assert.ok(html.includes('No screenshot'));
});

test('dates in en-GB with time zone', () => {
  assert.ok(html.includes('15 Nov 2026, 21:40'));
});

test('empty manifest', () => {
  const out = renderGallery({ version: 1, project: 'Acme', categories: [] }, new Map(), { now });
  assert.ok(out.includes('No rounds yet'));
});
