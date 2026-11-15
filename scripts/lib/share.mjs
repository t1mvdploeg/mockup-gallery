import { spawn } from 'node:child_process';

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function startTunnel(localUrl, { bin, ttlMs } = {}) {
  bin ??= process.env.MOCKUP_GALLERY_CLOUDFLARED || 'cloudflared';
  ttlMs ??= Number(process.env.MOCKUP_GALLERY_SHARE_TTL_MS) || 2 * 60 * 60 * 1000;
  // Test hook: a script path placed before the arguments, so node can play cloudflared.
  const pre = process.env.MOCKUP_GALLERY_CLOUDFLARED_ARGS;
  const args = [
    ...(pre ? [pre] : []),
    'tunnel',
    '--url',
    localUrl,
    '--http-host-header',
    new URL(localUrl).host,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let seen = '';
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      clearTimeout(wait);
      if (fn === reject) clearTimeout(ttl);
      fn(v);
    };
    const ttl = setTimeout(() => child.kill(), ttlMs);
    const wait = setTimeout(() => {
      child.kill();
      finish(reject, new Error('cloudflared gave no public URL within 30 seconds'));
    }, 30_000);
    const onData = (d) => {
      seen += d;
      const m = seen.match(URL_RE);
      if (m) finish(resolve, { child, url: m[0] });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', (e) =>
      finish(
        reject,
        e.code === 'ENOENT'
          ? new Error(
              `cloudflared not found (${bin}). Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`,
            )
          : e,
      ),
    );
    child.once('exit', () => finish(reject, new Error('cloudflared exited before giving a URL')));
    child.once('exit', () => clearTimeout(ttl));
  });
}
