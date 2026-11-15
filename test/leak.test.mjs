import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const self = path
  .relative(root, import.meta.filename)
  .split(path.sep)
  .join('/');
const PATTERNS = [/[A-Z]:\\Users\\/i, /[A-Z]:\/Users\//i, /\/Users\/[a-z]/, /\/home\/[a-z]/];

// Tracked and untracked files, minus git-ignored ones (e.g. .claude/settings.local.json).
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && f !== self && fs.existsSync(path.join(root, f)));

const terms = process.env.MOCKUP_GALLERY_PRIVATE_TERMS
  ? fs
      .readFileSync(process.env.MOCKUP_GALLERY_PRIVATE_TERMS, 'utf8')
      .split(/\r?\n/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  : [];

test('no private paths or terms in any file', () => {
  const hits = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(root, f));
    if (buf.includes(0)) continue; // binary
    const text = buf.toString('utf8');
    for (const re of PATTERNS) if (re.test(text)) hits.push(`${f}: ${re}`);
    const low = text.toLowerCase();
    for (const t of terms) if (low.includes(t)) hits.push(`${f}: private term`);
  }
  assert.deepEqual(hits, []);
});
