import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function findBrowser(env = process.env) {
  if (env.MOCKUP_GALLERY_BROWSER) return env.MOCKUP_GALLERY_BROWSER;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const base of [env.ProgramFiles, env['ProgramFiles(x86)'], env.LocalAppData]) {
    if (!base) continue;
    candidates.push(
      path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  }
  for (const dir of (env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of ['google-chrome', 'chromium', 'chromium-browser'])
      candidates.push(path.join(dir, name));
  }
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

export function screenshot(htmlFile, pngFile, browser = findBrowser()) {
  if (!browser) return false;
  try {
    execFileSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1440,900',
        '--virtual-time-budget=5000',
        `--screenshot=${pngFile}`,
        pathToFileURL(htmlFile).href,
      ],
      { stdio: 'ignore', timeout: 30000 },
    );
    return fs.existsSync(pngFile);
  } catch {
    return false;
  }
}
