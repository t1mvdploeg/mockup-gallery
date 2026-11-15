import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Kept outside the project (a cloned repo must not ship run state that makes `stop` kill a process)
// and in a per-user folder rather than the shared temp dir (no symlink planting by other users).
const stateDir = () => path.join(os.homedir(), '.cache', 'mockup-gallery');
const file = (dir) =>
  path.join(
    stateDir(),
    crypto.createHash('sha256').update(fs.realpathSync.native(dir)).digest('hex').slice(0, 16) +
      '.json',
  );

export function readRun(dir) {
  try {
    const f = file(dir);
    if (fs.lstatSync(f).isSymbolicLink()) return {};
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return {};
  }
}

export function writeRun(dir, data) {
  fs.mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  const f = file(dir);
  const tmp = `${f}.${process.pid}.tmp`;
  // rename replaces a planted symlink instead of writing through it
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(tmp, f);
}

export const clearRunFile = (dir) => {
  try {
    fs.rmSync(file(dir), { force: true });
  } catch {}
};

export function clearRun(dir, key) {
  const data = readRun(dir);
  delete data[key];
  if (Object.keys(data).length) writeRun(dir, data);
  else clearRunFile(dir);
}
