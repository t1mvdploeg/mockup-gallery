# Mockup Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code plugin whose skill files every round of design mockups into one self-contained gallery page per project, viewable on localhost or, on explicit request, through a temporary `cloudflared` link.

**Architecture:** One CLI, `scripts/gallery.mjs`, with sub-commands `round`, `build`, `serve`, `share`, `stop`, each a thin wrapper over a focused module in `scripts/lib/`. `gallery.json` in `<project>/mockups/gallery/` is the source of truth; `build` scans the variant folders and writes a static `index.html`. The skill (`skills/mockup-gallery/SKILL.md`) tells Claude when and how to call the CLI.

**Tech Stack:** Node.js ≥ 20, standard library only at runtime; `node:test` for tests; Prettier (devDependency) for code style; GitHub Actions for CI.

**Spec:** `docs/superpowers/specs/2026-11-15-mockup-gallery-design.md`

## Global Constraints

- Runtime: Node.js ≥ 20, **no runtime dependencies**; must work on macOS and Windows (CI on ubuntu-latest and windows-latest).
- Everything in English: UI, CLI output, skill, README, docs, commit messages.
- Gallery lives in `<project>/mockups/gallery/`; nothing outside it is served or written.
- Layout: sidebar of categories left (with round count); right side newest round on top, older rounds below and faded (`opacity: .55`); `NEW` badge on a category's newest round when it is < 24 hours old. Phone (< 700 px): sidebar becomes a horizontal row of category chips at the top.
- Labels: round number + letter (`3A`, `3B`, …), assigned by `round`, unique within a category; max 26 variants per round.
- Variant folder: `<category-slug>/round-<n>/<label>/` holding `screenshot.png` and/or `index.html`.
- `index.html` is one file: inline CSS and JS, works when opened from disk.
- Server binds `127.0.0.1`, port from the OS (port 0), serves only the gallery folder, never dotfiles.
- A tunnel starts only on an explicit `share` call; it stops on `stop` and by itself after 2 hours.
- Leak rule: no absolute user paths, personal names or client data anywhere in the repo, including these docs and test fixtures (use the made-up project "Acme").
- Commits: author `t1mvdploeg <133122358+t1mvdploeg@users.noreply.github.com>`, no `Co-Authored-By` line. No GitHub repo is created and nothing is pushed without the owner's go.
- Look: calm, Apple-like, system font, light with `prefers-color-scheme: dark` support.

## Review Focus

1. Category names and notes with HTML characters or emoji (`<b>&"Logo"`, `🎨 Icons`) → shown literally, never injected; `Logo` and `logo` are the same category.
2. Paths with spaces (project in `My Projects/`, browser under `Program Files`) → screenshots and serving still work.
3. Requests like `/../gallery.json`, `/%2e%2e/secret`, `/.run.json` → 404, nothing outside the gallery folder or any dotfile is served.
4. The `share` process dies abruptly (killed, terminal closed) → `stop` still ends `cloudflared`, because both pids are recorded.
5. Missing or corrupt `gallery.json` → `build` on an empty gallery writes a "No rounds yet" page; a corrupt file aborts with a clear error and is never overwritten.

---

### Task 1: Scaffold and the `round` command

**Files:**

- Create: `package.json`, `.claude-plugin/plugin.json`, `LICENSE` (MIT, "Tim van der Ploeg", 2026), `.gitignore` (`node_modules/`), `.prettierrc` (`{ "singleQuote": true, "printWidth": 100 }`)
- Create: `scripts/gallery.mjs`, `scripts/lib/manifest.mjs`
- Test: `test/manifest.test.mjs`

**Interfaces:**

- Produces (`scripts/lib/manifest.mjs`):
  - `galleryDir(projectRoot: string): string` → `<projectRoot>/mockups/gallery`
  - `slugify(name: string): string` — lowercase, non-alphanumerics → `-`, trimmed; `'🎨 App Icons!'` → `'app-icons'`; empty result → `'category'`
  - `loadManifest(dir: string): Manifest` — missing file → `{ version: 1, project: basename of project root, categories: [] }`; invalid JSON → throws `Error('gallery.json is not valid JSON: …')`
  - `saveManifest(dir: string, m: Manifest): void` — pretty JSON, trailing newline
  - `addRound(m: Manifest, { category: string, note: string, authors: string[], now: Date }): { round: Round, categorySlug: string }` — mutates `m`
  - `roundDir(dir, slug, n) → '<dir>/<slug>/round-<n>'`, `variantDir(dir, slug, n, label)`
  - Types: `Manifest = { version: 1, project: string, categories: Category[] }`, `Category = { name, slug, rounds: Round[] }`, `Round = { n: number, note: string, created: string /* ISO */, variants: { label: string, author: string }[] }`
- Produces (CLI): `node scripts/gallery.mjs round --project <root> --category <name> --note <text> --authors <A,B,C>` → creates the round and variant folders, saves the manifest, prints JSON `{ "dir": "<roundDir>", "labels": ["3A","3B","3C"] }`. `--project` defaults to `process.cwd()`.

- [ ] **Step 1: `git init`, set local `user.name`/`user.email` from Global Constraints, write the scaffold files.** `package.json`: `"type": "module"`, `"engines": { "node": ">=20" }`, scripts `test: node --test`, `format: prettier --write .`, `format:check: prettier --check .`, devDependency `prettier`. `plugin.json`: name `mockup-gallery`, version `0.1.0`, one-line description, author name, repository `https://github.com/t1mvdploeg/mockup-gallery`.
- [ ] **Step 2: Write failing tests** in `test/manifest.test.mjs` (use `fs.mkdtempSync(os.tmpdir())`):
  - `slugify` cases above; `addRound` on empty manifest → round `n: 1`, labels `['1A','1B']` for two authors, `created === now.toISOString()`.
  - Second round in same category → `n: 2`, labels start `2A`; `'logo'` after `'Logo'` → same category (match on slug), name stays `'Logo'`.
  - 27 authors → throws `/at most 26 variants/`.
  - `loadManifest` on a dir with `gallery.json` containing `{oops` → throws `/not valid JSON/`; on an empty dir → empty manifest.
  - CLI: run `round` via `child_process.execFileSync(process.execPath, [...])` in a temp project whose path contains a space → stdout JSON labels `['1A','1B']`, folders `mockups/gallery/logo/round-1/1A` and `1B` exist.
- [ ] **Step 3: Run** `npm test` → FAIL (module not found).
- [ ] **Step 4: Implement** `manifest.mjs` and the `round` sub-command in `gallery.mjs` (argument parsing with `node:util` `parseArgs`; unknown sub-command → usage text, exit 1).
- [ ] **Step 5: Run** `npm test` → PASS; `npx prettier --check .` → clean.
- [ ] **Step 6: Commit** `feat: manifest and round command`

### Task 2: Gallery page and the `build` command

Owner judges the look; build this task on the most capable model and compare against the approved layout (layout A in the spec).

**Files:**

- Create: `scripts/lib/render.mjs`, `scripts/lib/check-html.mjs`, `scripts/lib/build.mjs`
- Modify: `scripts/gallery.mjs` (add `build`)
- Test: `test/render.test.mjs`, `test/check-html.test.mjs`, `test/build.test.mjs`

**Interfaces:**

- Consumes: Task 1 manifest functions.
- Produces:
  - `renderGallery(m: Manifest, files: Map<string /* label path 'slug/round-n/label' */, { image: boolean, html: boolean }>, opts: { now: Date, timeZone?: string }): string`
  - `findOutsideRefs(html: string, htmlFile: string, variantDir: string): string[]` — returns `src`/`href`/CSS `url()` references that resolve outside `variantDir` or are absolute file paths; ignores `http:`, `https:`, `data:`, `mailto:`, `#…`.
  - `buildGallery(projectRoot: string, opts?: { now?: Date, shoot?: (htmlFile, pngFile) => boolean }): { file: string, warnings: string[] }` — scans every variant folder, collects warnings from `findOutsideRefs`, calls `shoot` for variants with `index.html` but no `screenshot.png` (default: no-op returning false until Task 3), writes `index.html` and a `.gitignore` containing `.run.json` in the gallery dir.
  - CLI: `gallery.mjs build [--project <root>]` prints the `index.html` path, then each warning prefixed `warning: `.

- [ ] **Step 1: Write failing tests:**
  - `render`: manifest "Acme" with category `Logo` (rounds 1 and 2, round 2 created 1 h before `now`) and category `<b>&"Icons"` (one round, 3 days old). Assert: sidebar lists `Logo` with count `2`; round 2 appears before round 1 in the output; exactly one `NEW` badge; `&lt;b&gt;&amp;&quot;Icons&quot;` present and `<b>&"Icons"` absent; each variant shows its label (`2A`); a variant with `html: true` links to `logo/round-2/2A/index.html`; a variant with `image: false` renders a placeholder with the text `No screenshot`; date with `timeZone: 'UTC'` renders as `15 Nov 2026, 21:40` style (en-GB, `day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'`).
  - `render` on a manifest without categories → contains `No rounds yet`.
  - `check-html`: `<link href="../../shared.css">` and `<img src="C:/x.png">` reported; `<img src="logo.svg">`, `https://…`, `data:…`, `#top` not reported.
  - `build`: temp project, `round` for two variants, write `1A/index.html` referencing `../../../style.css` → returns one warning naming `1A`; `index.html` and `.gitignore` exist; corrupt `gallery.json` → throws and file content unchanged.
- [ ] **Step 2: Run** `npm test` → new tests FAIL.
- [ ] **Step 3: Implement.** Static HTML from the server side (no client framework); a small inline script switches the visible category from the sidebar/chips and remembers nothing. Without JS all categories show stacked. Screenshot click opens the variant's `index.html` in a new tab when present, else the image itself.
- [ ] **Step 4: Run** `npm test` → PASS. Open a generated sample gallery (Acme, 3 categories, rounds with real PNGs from a quick headless shot or any test image) in the browser at desktop and 390 px width; check layout A, faded older rounds, NEW badge, dark mode.
- [ ] **Step 5: Commit** `feat: gallery page and build command`

### Task 3: Automatic screenshots

**Files:**

- Create: `scripts/lib/shot.mjs`
- Modify: `scripts/lib/build.mjs` (default `shoot`)
- Test: `test/shot.test.mjs`

**Interfaces:**

- Produces: `findBrowser(env = process.env): string | null` — `MOCKUP_GALLERY_BROWSER` first; then macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`; Windows `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%LocalAppData%` + `\Google\Chrome\Application\chrome.exe` / `\Microsoft\Edge\Application\msedge.exe`; Linux `google-chrome`, `chromium`, `chromium-browser` on `PATH`. `screenshot(htmlFile: string, pngFile: string, browser = findBrowser()): boolean` — runs `--headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --screenshot=<pngFile> <file URL>` via `execFileSync` (no shell), 30 s timeout; returns `false` (no throw) when no browser or it fails.

- [ ] **Step 1: Failing tests:** `findBrowser({ MOCKUP_GALLERY_BROWSER: '/nope' })` → `'/nope'`; `screenshot` with browser `'/nope'` → `false`; if a real browser is found: `screenshot` of a temp `index.html` in a folder whose path has a space → `true` and PNG exists with PNG magic bytes (else `t.skip('no browser')`). `build` on a variant with only `index.html` and a real browser → `screenshot.png` created.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: automatic screenshots with system Chrome or Edge`

### Task 4: Local server and `stop`

**Files:**

- Create: `scripts/lib/serve.mjs`, `scripts/lib/run-file.mjs`
- Modify: `scripts/gallery.mjs` (add `serve`, `stop`)
- Test: `test/serve.test.mjs`

**Interfaces:**

- Produces:
  - `startServer(dir: string, port = 0): Promise<{ server: http.Server, url: string }>` — `url` is `http://127.0.0.1:<port>/`; `/` → `index.html`; decodes the path, rejects (404) anything resolving outside `dir` or with a segment starting with `.`; content types for html, css, js, json, png, jpg, webp, svg, woff2.
  - `run-file.mjs`: `readRun(dir): { serve?: { pid, url }, share?: { pid, tunnelPid, url, started } }`, `writeRun(dir, data)`, `clearRun(dir, key)` — file `<dir>/.run.json`.
  - CLI `serve [--project <root>]`: if `.run.json` has a live serve pid → print its url and exit 0; else start, record `{ pid: process.pid, url }`, print url, keep running; on SIGINT/SIGTERM clear the entry.
  - CLI `stop [--project <root>]`: kill recorded `share.tunnelPid`, `share.pid`, `serve.pid` (ignore ESRCH), delete `.run.json`, print what was stopped.
- [ ] **Step 1: Failing tests:** server on a temp gallery: `GET /` → 200 HTML; `GET /logo/round-1/1A/screenshot.png` → `image/png`; `GET /../gallery.json` (raw path via `http.request`), `/%2e%2e/x`, `/.run.json` → 404; `gallery.json` itself is served (it holds nothing private). `stop` with a `.run.json` pointing at a spawned `node -e "setInterval(()=>{},1e3)"` → that process is gone and `.run.json` deleted.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: local server and stop command`

**Natural stopping point:** after Task 4 the gallery is fully usable on localhost.

### Task 5: Temporary public link (`share`)

**Files:**

- Create: `scripts/lib/share.mjs`
- Modify: `scripts/gallery.mjs` (add `share`)
- Test: `test/share.test.mjs`, `test/fixtures/fake-cloudflared.mjs`

**Interfaces:**

- Consumes: `startServer`, run-file helpers.
- Produces: `startTunnel(localUrl: string, { bin?: string, ttlMs?: number }): Promise<{ child: ChildProcess, url: string }>` — spawns `<bin> tunnel --url <localUrl>` (bin: `MOCKUP_GALLERY_CLOUDFLARED` or `cloudflared`), resolves with the first `https://*.trycloudflare.com` found on stdout/stderr within 30 s, rejects `Error('cloudflared not found …')` on ENOENT, kills the child after `ttlMs` (default `2 * 60 * 60 * 1000`, override `MOCKUP_GALLERY_SHARE_TTL_MS`).
  - CLI `share [--project <root>]`: ensures a server (reuses a live one from `.run.json`, else starts one in-process), starts the tunnel, records `share: { pid, tunnelPid, url, started }`, prints the public URL and the line `Stops automatically in 2 hours or with: gallery.mjs stop`. When cloudflared is missing: print `cloudflared is not installed — send screenshots in the chat instead.` and exit 2.
- [ ] **Step 1: Failing tests** using the fake (a Node script printing `https://acme-test.trycloudflare.com` to stderr, then idling): URL resolved; with `ttlMs: 200` the child has exited after 500 ms; bin `'/nope'` → rejects `/cloudflared not found/`; CLI `share` with the fake and TTL 300 ms → prints the URL, `.run.json` has both pids, and after `stop` neither pid is alive (Review Focus 4: kill the share process with `SIGKILL` first, then `stop` still ends the fake tunnel).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: temporary public link via cloudflared`

### Task 6: Skill, README, CI and leak test

**Files:**

- Create: `skills/mockup-gallery/SKILL.md`, `README.md`, `.github/workflows/test.yml`, `test/leak.test.mjs`

**Interfaces:**

- Consumes: the CLI as `node "${CLAUDE_PLUGIN_ROOT}/scripts/gallery.mjs" <command>`.

- [ ] **Step 1: Leak test (failing first if any doc leaks):** walk all files except `.git/`, `node_modules/` and the test itself; fail on `/[A-Z]:\\Users\\/i`, `/[A-Z]:\/Users\//i`, `/\/Users\/[a-z]/`, `/\/home\/[a-z]/`, and on every line of the file named by `MOCKUP_GALLERY_PRIVATE_TERMS` when that env var is set. Run `npm test` and fix any hit.
- [ ] **Step 2: `SKILL.md`.** Frontmatter `name: mockup-gallery`; description triggers on making or comparing design mockups/variants, "show the mockups", "gallery", `/mockup-gallery`. Body, in order: (1) before making mockups, run `round` with category, one-line note and one author per variant (`Opus`, `Sonnet`, `Codex`, …) and write each variant into its printed folder as a self-contained `index.html` and/or `screenshot.png`; one subagent per variant is fine; (2) run `build`, fix any `warning:` lines; (3) run `serve` in the background and give the localhost link; (4) when the user is on a phone/Remote Control: send the screenshots in the chat, each with its label above it, and start `share` only when the user explicitly asks for a link — never on your own, since a project may hold real data; (5) refer to variants by label (`Logo 3B`) in replies; (6) run `stop` when the user is done looking or at the end of the session. `/mockup-gallery` alone = `build` + `serve` + link.
- [ ] **Step 3: README** (English, ≤ 700 words): title, one-line pitch, placeholder line for the screenshot (`<!-- screenshot: added in a later round -->`), install (`/plugin install` from the GitHub repo), what it does, how it works (folders, labels, commands), what it does not do (non-goals of the spec), licence. Badge for the test workflow.
- [ ] **Step 4: CI** `test.yml`: on push and pull_request; matrix `ubuntu-latest`, `windows-latest`; Node 20; `npm ci`, `npm run format:check`, `npm test`. Run `npm install` once locally to create `package-lock.json`.
- [ ] **Step 5: Full check:** `npm run format:check && npm test` → all PASS. Try the plugin end to end in a scratch project: `round` (3 variants) → write three small HTML mockups → `build` → `serve` → open the link in the browser → `stop`.
- [ ] **Step 6: Commit** `feat: skill, README, CI and leak test`, then squash Tasks 1–6 into one commit `feat: mockup gallery plugin v0.1.0` before the owner reviews (few commits rule). Do not create a GitHub repo or push.
