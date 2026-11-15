import fs from 'node:fs';
import path from 'node:path';

const file = (dir) => path.join(dir, '.run.json');

export function readRun(dir) {
  try {
    return JSON.parse(fs.readFileSync(file(dir), 'utf8'));
  } catch {
    return {};
  }
}

export function writeRun(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(dir), JSON.stringify(data, null, 2) + '\n');
}

export function clearRun(dir, key) {
  const data = readRun(dir);
  delete data[key];
  if (Object.keys(data).length) writeRun(dir, data);
  else fs.rmSync(file(dir), { force: true });
}
