import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { startServer } from '../scripts/lib/serve.mjs';
import { readRun, writeRun, clearRun } from '../scripts/lib/run-file.mjs';

const CLI = path.resolve('scripts/gallery.mjs');

function tmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-serve-'));
  const dir = path.join(root, 'mockups', 'gallery');
  fs.mkdirSync(path.join(dir, 'logo', 'round-1', '1A'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(dir, 'gallery.json'), '{}');
  fs.writeFileSync(path.join(dir, '.secret.json'), '{}');
  fs.writeFileSync(path.join(dir, 'logo', 'round-1', '1A', 'screenshot.png'), 'x');
  fs.writeFileSync(path.join(root, 'mockups', 'secret.txt'), 'secret');
  return { root, dir };
}

const get = (url, p) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    http
      .request({ host: u.hostname, port: u.port, path: p }, (res) => {
        res.resume();
        res.on('end', () => resolve(res));
      })
      .on('error', reject)
      .end();
  });

test('serves the gallery and nothing else', async () => {
  const { dir } = tmpProject();
  const { server, url } = await startServer(dir);
  try {
    const root = await get(url, '/');
    assert.equal(root.statusCode, 200);
    assert.match(root.headers['content-type'], /text\/html/);
    const png = await get(url, '/logo/round-1/1A/screenshot.png');
    assert.equal(png.headers['content-type'], 'image/png');
    assert.equal((await get(url, '/gallery.json')).statusCode, 200);
    for (const p of [
      '/../secret.txt',
      '/%2e%2e/secret.txt',
      '/.secret.json',
      '/logo/%2e/x',
      '/%5c..%5csecret.txt',
      '/%zz',
    ])
      assert.equal((await get(url, p)).statusCode, 404, p);
    assert.equal(server.address().address, '127.0.0.1');
  } finally {
    server.close();
  }
});

test('stop kills recorded processes and clears the run state', async () => {
  const { root, dir } = tmpProject();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e3)'], { stdio: 'ignore' });
  const exited = new Promise((r) => child.once('exit', r));
  writeRun(dir, { serve: { pid: child.pid, url: 'http://127.0.0.1:1/' } });
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, 'stop', '--project', root]);
    let s = '';
    p.stdout.on('data', (d) => (s += d));
    p.on('close', () => resolve(s));
  });
  await exited;
  assert.ok(out.includes(String(child.pid)));
  assert.equal(fs.existsSync(path.join(dir, '.run.json')), false);
  assert.deepEqual(readRun(dir), {});
});

const getHost = (url, host) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    http
      .request({ host: u.hostname, port: u.port, path: '/', headers: { host } }, (res) => {
        res.resume();
        res.on('end', () => resolve(res));
      })
      .on('error', reject)
      .end();
  });

test('rejects foreign Host headers, accepts localhost', async () => {
  const { dir } = tmpProject();
  const { server, url } = await startServer(dir);
  const port = new URL(url).port;
  try {
    assert.equal((await getHost(url, 'evil.example')).statusCode, 403);
    assert.equal((await getHost(url, `evil.example:${port}`)).statusCode, 403);
    assert.equal((await getHost(url, `localhost:${port}`)).statusCode, 200);
    assert.equal((await getHost(url, `127.0.0.1:${port}`)).statusCode, 200);
  } finally {
    server.close();
  }
});

test('does not follow a symlink out of the gallery', async (t) => {
  const { root, dir } = tmpProject();
  try {
    fs.symlinkSync(path.join(root, 'mockups', 'secret.txt'), path.join(dir, 'link.txt'));
  } catch (e) {
    return t.skip(`cannot create symlink: ${e.code}`);
  }
  const { server, url } = await startServer(dir);
  try {
    assert.equal((await get(url, '/link.txt')).statusCode, 404);
  } finally {
    server.close();
  }
});

test('Windows 8.3 short name of a dotfile is a 404', async (t) => {
  if (process.platform !== 'win32') return t.skip('windows only');
  const { dir } = tmpProject();
  const { server, url } = await startServer(dir);
  try {
    assert.equal((await get(url, '/SECRET~1.JSO')).statusCode, 404);
  } finally {
    server.close();
  }
});

test('stop ignores invalid pids in the run state', async () => {
  const { root, dir } = tmpProject();
  writeRun(dir, { serve: { pid: -1, url: 'x' }, share: { pid: '12', tunnelPid: 0 } });
  const code = await new Promise((resolve) =>
    spawn(process.execPath, [CLI, 'stop', '--project', root]).on('close', resolve),
  );
  assert.equal(code, 0);
});

test('run state lives outside the gallery and a planted .run.json is ignored by stop', async () => {
  const { root, dir } = tmpProject();
  writeRun(dir, { serve: { pid: 0, url: 'x' } });
  assert.equal(fs.existsSync(path.join(dir, '.run.json')), false);
  clearRun(dir, 'serve');
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e3)'], { stdio: 'ignore' });
  try {
    fs.writeFileSync(path.join(dir, '.run.json'), JSON.stringify({ serve: { pid: child.pid } }));
    await new Promise((resolve) =>
      spawn(process.execPath, [CLI, 'stop', '--project', root]).on('close', resolve),
    );
    process.kill(child.pid, 0); // throws if stop killed it
  } finally {
    child.kill();
  }
});

test('run state lives in a per-user folder, not the shared temp dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-state-'));
  writeRun(dir, { serve: { pid: 1, url: 'x' } });
  const stateDir = path.join(os.homedir(), '.cache', 'mockup-gallery');
  const files = fs.readdirSync(stateDir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0);
  assert.ok(!fs.readdirSync(stateDir).some((f) => f.endsWith('.tmp')));
  assert.deepEqual(readRun(dir), { serve: { pid: 1, url: 'x' } });
  clearRun(dir, 'serve');
  assert.deepEqual(readRun(dir), {});
});
