const DAY = 24 * 3600e3;

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function renderGallery(m, files, { now, timeZone }) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const date = (iso) => fmt.format(new Date(iso));
  const cats = m.categories.map((c) => {
    const rounds = [...c.rounds].sort((a, b) => b.n - a.n);
    const isNew = rounds.length > 0 && now - new Date(rounds[0].created) < DAY;
    return { ...c, rounds, isNew };
  });
  const all = cats.flatMap((c) => c.rounds.map((r) => ({ c, t: Date.parse(r.created) })));
  const latest = all.sort((a, b) => b.t - a.t)[0];
  const title = `${esc(m.project)} · Mockup gallery`;

  const variant = (c, r, v) => {
    const base = `${c.slug}/round-${r.n}/${v.label}`;
    const f = files.get(base) ?? { image: false, html: false };
    const name = `${c.name} ${v.label}${v.author ? ` by ${v.author}` : ''}`;
    const inner = f.image
      ? `<img src="${esc(encodeURI(`${base}/screenshot.png`))}" alt="${esc(name)}" loading="lazy">`
      : `<span class="ph">No screenshot${f.html ? '<small>Open the HTML mockup</small>' : ''}</span>`;
    const target = f.html ? 'index.html' : f.image ? 'screenshot.png' : '';
    const thumb = target
      ? `<a class="th" href="${esc(encodeURI(`${base}/${target}`))}" target="_blank" rel="noopener" title="${f.html ? 'Open mockup' : 'Open screenshot'} ${esc(v.label)} in a new tab">${inner}</a>`
      : `<div class="th">${inner}</div>`;
    return `<figure class="v">${thumb}<figcaption><strong>${esc(v.label)}</strong>${
      v.author ? `<span>${esc(v.author)}</span>` : ''
    }</figcaption></figure>`;
  };

  const round = (c, r, i) => `
      <article class="round${i > 0 ? ' old' : ''}">
        <header class="rh">
          <h3>Round ${esc(r.n)}</h3>${i === 0 && c.isNew ? '<span class="new">NEW</span>' : ''}
          <p><time datetime="${esc(r.created)}">${esc(date(r.created))}</time>${
            r.note ? ` · ${esc(r.note)}` : ''
          }</p>
        </header>
        <div class="grid">${r.variants.map((v) => variant(c, r, v)).join('')}</div>
      </article>`;

  const section = (c) => `
    <section class="cat" id="cat-${esc(c.slug)}" aria-labelledby="h-${esc(c.slug)}">
      <h2 id="h-${esc(c.slug)}">${esc(c.name)} <span>${plural(c.rounds.length, 'round')}</span></h2>${c.rounds
        .map((r, i) => round(c, r, i))
        .join('')}
    </section>`;

  const nav = cats
    .map(
      (c) =>
        `<a href="#cat-${esc(c.slug)}"><span class="name">${esc(c.name)}</span>${
          c.isNew ? '<i class="dot" title="New round"></i>' : ''
        }<span class="count">${c.rounds.length}</span></a>`,
    )
    .join('\n      ');

  const body = cats.length
    ? `<nav class="side" aria-label="Categories" data-default="cat-${esc(latest ? latest.c.slug : cats[0].slug)}">
      <p class="side-h">Categories</p>
      ${nav}
    </nav>
    <main>${cats.map(section).join('')}
    </main>`
    : `<main class="empty">
      <h2>No rounds yet</h2>
      <p>Mockups appear here as rounds once they are added to the gallery.</p>
    </main>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>
:root {
  --bg: #f5f5f7; --surface: #fff; --line: #e3e3e8; --text: #1d1d1f; --muted: #6e6e73;
  --hover: #f0f0f3; --accent: #0066cc; --accent-bg: #e8f0fe; --thumb: #ededf0;
  --chip: #e8e8ed; --chip-on: #1d1d1f; --chip-on-text: #fff; --new: #248a3d; --new-text: #fff;
  --shadow: 0 1px 2px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 8%);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000; --surface: #1c1c1e; --line: #2c2c2e; --text: #f5f5f7; --muted: #98989d;
    --hover: #2c2c2e; --accent: #2997ff; --accent-bg: rgb(41 151 255 / 16%); --thumb: #2c2c2e;
    --chip: #2c2c2e; --chip-on: #f5f5f7; --chip-on-text: #000; --new: #30d158; --new-text: #000;
    --shadow: 0 8px 24px rgb(0 0 0 / 50%);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.top {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  padding: 14px 24px; background: var(--surface); border-bottom: 1px solid var(--line);
}
.top h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.top span { color: var(--muted); font-size: 13px; }
.top time { margin-left: auto; color: var(--muted); font-size: 13px; }
.layout { display: flex; align-items: flex-start; }
.side {
  position: sticky; top: 0; flex: 0 0 232px; min-height: calc(100vh - 50px); max-height: 100vh;
  overflow-y: auto; padding: 20px 12px; background: var(--surface); border-right: 1px solid var(--line);
}
.side-h {
  margin: 0 10px 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted);
}
.side a {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px; margin-bottom: 2px;
  border-radius: 8px; font-size: 14px;
}
.side a:hover { background: var(--hover); }
.side .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side .count { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.side .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--new); }
.side a.on { background: var(--accent-bg); color: var(--accent); font-weight: 600; }
.side a.on .count { color: inherit; }
main { flex: 1; min-width: 0; padding: 32px 40px 40px; max-width: 1480px; }
.cat { margin-bottom: 24px; }
.cat h2 { margin: 0 0 28px; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
.cat h2 span { margin-left: 6px; font-size: 15px; font-weight: 400; letter-spacing: 0; color: var(--muted); }
.round { margin-bottom: 44px; }
.round.old { opacity: 0.55; transition: opacity 0.2s; }
.round.old:hover, .round.old:focus-within { opacity: 1; }
.rh { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; margin-bottom: 14px; }
.rh h3 { margin: 0; font-size: 17px; font-weight: 600; }
.rh p { margin: 0; color: var(--muted); font-size: 14px; }
.new {
  align-self: center; padding: 2px 7px; border-radius: 99px; background: var(--new); color: var(--new-text);
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.v {
  margin: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--line);
  border-radius: 12px; transition: box-shadow 0.2s;
}
.v:hover { box-shadow: var(--shadow); }
.th { display: block; aspect-ratio: 16 / 10; background: var(--thumb); border-bottom: 1px solid var(--line); }
.th img { display: block; width: 100%; height: 100%; object-fit: contain; }
.ph {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  height: 100%; color: var(--muted); font-size: 13px;
}
.ph small { color: var(--accent); font-size: 13px; }
.v figcaption { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 14px; }
.v strong { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.v figcaption span { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { padding: 96px 24px; text-align: center; }
.empty h2 { margin: 0 0 8px; font-size: 22px; }
.empty p { margin: 0; color: var(--muted); }
@media (max-width: 699px) {
  .top { padding: 12px 16px; }
  .layout { display: block; }
  .side {
    display: flex; gap: 8px; min-height: 0; padding: 10px 16px; overflow-x: auto; scrollbar-width: none;
    border-right: 0; border-bottom: 1px solid var(--line); z-index: 1;
  }
  .side::-webkit-scrollbar { display: none; }
  .side-h { display: none; }
  .side a { flex: none; margin: 0; padding: 6px 12px; border-radius: 99px; background: var(--chip); font-size: 14px; }
  .side a.on { background: var(--chip-on); color: var(--chip-on-text); }
  main { padding: 24px 16px 48px; }
  .cat h2 { font-size: 24px; margin-bottom: 20px; }
  .grid { gap: 14px; }
}
</style>
</head>
<body>
  <header class="top">
    <h1>${esc(m.project)}</h1><span>Mockup gallery</span>${
      latest
        ? `\n    <time datetime="${esc(new Date(latest.t).toISOString())}">Updated ${esc(date(latest.t))}</time>`
        : ''
    }
  </header>
  <div class="layout">
    ${body}
  </div>
${cats.length ? SCRIPT : ''}</body>
</html>
`;
}

// Shows one category at a time; without JS all categories stay stacked.
const SCRIPT = `<script>
(() => {
  const nav = document.querySelector('.side');
  const links = [...nav.querySelectorAll('a')];
  const show = (id) => {
    for (const s of document.querySelectorAll('.cat')) s.hidden = s.id !== id;
    for (const a of links) {
      const on = a.hash === '#' + id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  for (const a of links)
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(a.hash.slice(1));
      a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      window.scrollTo(0, 0);
    });
  show(nav.dataset.default);
})();
</script>
`;
