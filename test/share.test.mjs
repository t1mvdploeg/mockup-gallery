import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startTunnel } from '../scripts/lib/share.mjs';
import { readRun } from '../scripts/lib/run-file.mjs';

const CLI = path.resolve('scripts/gallery.mjs');
const FAKE = path.resolve('test-fixtures/fake-cloudflared.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const until = async (fn, ms = 5000) => {
  for (let t = 0; t < ms; t += 50) {
    if (await fn()) return true;
    await sleep(50);
  }
  return false;
};

// Test hook: lets a node script stand in for the cloudflared binary (no shell involved).
process.env.MOCKUP_GALLERY_CLOUDFLARED_ARGS = FAKE;

test('startTunnel resolves with the trycloudflare URL', async () => {
  const { child, url } = await startTunnel('http://127.0.0.1:1', { bin: process.execPath });
  try {
    assert.equal(url, 'https://acme-test.trycloudflare.com');
  } finally {
    child.kill();
  }
});

test('startTunnel passes --http-host-header with the local host', async () => {
  const { child } = await startTunnel('http://127.0.0.1:4321/', { bin: process.execPath });
  try {
    const a = child.spawnargs;
    assert.equal(a[a.indexOf('--http-host-header') + 1], '127.0.0.1:4321');
  } finally {
    child.kill();
  }
});

test('startTunnel kills the child after the ttl', async () => {
  const { child } = await startTunnel('http://127.0.0.1:1', { bin: process.execPath, ttlMs: 200 });
  await sleep(500);
  assert.equal(alive(child.pid), false);
});

test('startTunnel rejects when the binary is missing', async () => {
  await assert.rejects(
    startTunnel('http://127.0.0.1:1', { bin: '/nope' }),
    /cloudflared not found/,
  );
});

test('CLI share records both pids; stop ends the tunnel even after SIGKILL of share', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-share-'));
  const dir = path.join(root, 'mockups', 'gallery');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), 'hi');
  const env = {
    ...process.env,
    MOCKUP_GALLERY_CLOUDFLARED: process.execPath,
    MOCKUP_GALLERY_SHARE_TTL_MS: '60000',
  };
  const p = spawn(process.execPath, [CLI, 'share', '--project', root], { env });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  try {
    assert.ok(await until(() => out.includes('Stops automatically in 2 hours')), out);
    assert.match(out, /https:\/\/acme-test\.trycloudflare\.com/);
    const { share } = readRun(dir);
    assert.equal(share.pid, p.pid);
    assert.ok(alive(share.tunnelPid));
    p.kill('SIGKILL');
    await new Promise((r) => p.once('exit', r));
    await new Promise((r) => {
      const s = spawn(process.execPath, [CLI, 'stop', '--project', root]);
      s.on('close', r);
    });
    assert.ok(await until(() => !alive(share.tunnelPid)), 'tunnel still alive');
    assert.equal(fs.existsSync(path.join(dir, '.run.json')), false);
  } finally {
    p.kill('SIGKILL');
  }
});

test('CLI share without cloudflared exits 2 with advice', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-share-'));
  fs.mkdirSync(path.join(root, 'mockups', 'gallery'), { recursive: true });
  const p = spawn(process.execPath, [CLI, 'share', '--project', root], {
    env: { ...process.env, MOCKUP_GALLERY_CLOUDFLARED: '/nope' },
  });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  const code = await new Promise((r) => p.on('close', r));
  assert.equal(code, 2);
  assert.match(out, /cloudflared is not installed/);
});

test('second share prints the same URL, starts no second tunnel, stop ends everything', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-share-'));
  const dir = path.join(root, 'mockups', 'gallery');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), 'hi');
  const env = {
    ...process.env,
    MOCKUP_GALLERY_CLOUDFLARED: process.execPath,
    MOCKUP_GALLERY_SHARE_TTL_MS: '60000',
  };
  const p = spawn(process.execPath, [CLI, 'share', '--project', root], { env });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  try {
    assert.ok(await until(() => out.includes('Stops automatically')), out);
    const first = readRun(dir).share;
    let again = '';
    const p2 = spawn(process.execPath, [CLI, 'share', '--project', root], { env });
    p2.stdout.on('data', (d) => (again += d));
    assert.equal(await new Promise((r) => p2.on('close', r)), 0);
    assert.match(again, /https:\/\/acme-test\.trycloudflare\.com/);
    assert.deepEqual(readRun(dir).share, first);
    assert.equal(readRun(dir).serve, undefined);
    await new Promise((r) =>
      spawn(process.execPath, [CLI, 'stop', '--project', root]).on('close', r),
    );
    assert.ok(await until(() => !alive(first.tunnelPid) && !alive(first.pid)));
  } finally {
    p.kill('SIGKILL');
  }
});
