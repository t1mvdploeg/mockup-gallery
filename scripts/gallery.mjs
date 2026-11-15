#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  galleryDir,
  loadManifest,
  saveManifest,
  addRound,
  roundDir,
  variantDir,
} from './lib/manifest.mjs';
import { buildGallery } from './lib/build.mjs';
import { startServer } from './lib/serve.mjs';
import { startTunnel } from './lib/share.mjs';
import { readRun, writeRun, clearRun } from './lib/run-file.mjs';

const USAGE = `Usage:
  gallery.mjs round --category <name> --note <text> --authors <A,B,C> [--project <root>]
  gallery.mjs build [--project <root>]
  gallery.mjs serve [--project <root>]
  gallery.mjs share [--project <root>]
  gallery.mjs stop [--project <root>]`;

function round(args) {
  const { values } = parseArgs({
    args,
    options: {
      project: { type: 'string', default: process.cwd() },
      category: { type: 'string' },
      note: { type: 'string', default: '' },
      authors: { type: 'string' },
    },
  });
  if (!values.category || !values.authors) throw new Error(USAGE);
  const dir = galleryDir(values.project);
  const m = loadManifest(dir);
  const authors = values.authors
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const { round: r, categorySlug } = addRound(m, {
    category: values.category,
    note: values.note,
    authors,
    now: new Date(),
  });
  for (const v of r.variants)
    fs.mkdirSync(variantDir(dir, categorySlug, r.n, v.label), { recursive: true });
  saveManifest(dir, m);
  console.log(
    JSON.stringify({
      dir: roundDir(dir, categorySlug, r.n),
      labels: r.variants.map((v) => v.label),
    }),
  );
}

function build(args) {
  const { values } = parseArgs({
    args,
    options: { project: { type: 'string', default: process.cwd() } },
  });
  const { file, warnings } = buildGallery(values.project);
  console.log(file);
  for (const w of warnings) console.log(`warning: ${w}`);
}

const projectDir = (args) =>
  galleryDir(
    parseArgs({ args, options: { project: { type: 'string', default: process.cwd() } } }).values
      .project,
  );

const okPid = (p) => Number.isInteger(p) && p > 0 && p !== process.pid;

const alive = (pid) => {
  if (!okPid(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

async function serve(args) {
  const dir = projectDir(args);
  const run = readRun(dir);
  if (run.serve && alive(run.serve.pid)) return console.log(run.serve.url);
  const { url } = await startServer(dir);
  writeRun(dir, { ...readRun(dir), serve: { pid: process.pid, url } });
  console.log(url);
  const bye = () => {
    clearRun(dir, 'serve');
    process.exit(0);
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}

async function share(args) {
  const dir = projectDir(args);
  const run = readRun(dir);
  if (run.share && alive(run.share.pid)) {
    console.log(run.share.url);
    console.log('Already shared. Stop it with: gallery.mjs stop');
    return;
  }
  // Always our own server: never tunnel a URL read from .run.json, never touch the serve entry.
  const { url: local } = await startServer(dir);
  let tunnel;
  try {
    tunnel = await startTunnel(local);
  } catch (e) {
    if (!/^cloudflared not found/.test(e.message)) throw e;
    console.log('cloudflared is not installed — send screenshots in the chat instead.');
    process.exit(2);
  }
  const { child, url } = tunnel;
  const cleanup = () => {
    clearRun(dir, 'share');
    process.exit(0);
  };
  writeRun(dir, {
    ...readRun(dir),
    share: {
      pid: process.pid,
      tunnelPid: child.pid,
      url,
      local,
      started: new Date().toISOString(),
    },
  });
  console.log(url);
  console.log('Stops automatically in 2 hours or with: gallery.mjs stop');
  child.once('exit', cleanup);
  process.on('SIGINT', () => (child.kill(), cleanup()));
  process.on('SIGTERM', () => (child.kill(), cleanup()));
}

function stop(args) {
  const dir = projectDir(args);
  const { serve: s, share } = readRun(dir);
  const targets = [
    ['tunnel', share?.tunnelPid],
    ['share', share?.pid],
    ['serve', s?.pid],
  ];
  for (const [name, pid] of targets) {
    if (!okPid(pid)) continue;
    try {
      process.kill(pid);
      console.log(`stopped ${name} (pid ${pid})`);
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
    }
  }
  // Windows kills without running signal handlers, so delete the file here.
  fs.rmSync(path.join(dir, '.run.json'), { force: true });
  if (!targets.some(([, pid]) => okPid(pid))) console.log('nothing running');
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'round') round(rest);
  else if (cmd === 'build') build(rest);
  else if (cmd === 'serve') await serve(rest);
  else if (cmd === 'share') await share(rest);
  else if (cmd === 'stop') stop(rest);
  else {
    console.error(USAGE);
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
