import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Kept outside the project: a cloned repo must not be able to ship run state that makes `stop` kill a process.
const file = (dir) =>
  path.join(
    os.tmpdir(),
    'mockup-gallery',
    crypto.createHash('sha256').update(fs.realpathSync.native(dir)).digest('hex').slice(0, 16) +
      '.json',
  );

export function readRun(dir) {
  try {
    return JSON.parse(fs.readFileSync(file(dir), 'utf8'));
  } catch {
    return {};
  }
}

export function writeRun(dir, data) {
  fs.mkdirSync(path.dirname(file(dir)), { recursive: true });
  fs.writeFileSync(file(dir), JSON.stringify(data, null, 2) + '\n');
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
