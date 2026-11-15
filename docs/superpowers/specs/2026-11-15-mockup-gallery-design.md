# Mockup Gallery — design

Date: 2026-11-15. Status: approved by the owner on 2026-11-15.

## Intent

When Claude makes design mockups, they end up scattered over folders, chat screenshots and throwaway servers. The owner often reviews them from a phone (Claude Code Remote Control), and keeps asking for the same thing: "put them in a gallery, with the rounds and timestamps, so I know what is what." This project turns that into a reusable Claude Code skill: every mockup Claude makes lands, as a new round, in one gallery page per project, which can be opened on localhost or shared to a phone through a temporary link.

It is also a public portfolio project, so it must look professional and contain nothing private.

## Goals

- One gallery page per project at `mockups/gallery/index.html`, rebuilt whenever mockups are added.
- Structure: **categories** (e.g. Logo, App icons, Deck screens) → **rounds** (numbered, with date, time and a one-line description) → **variants** (a screenshot with a clear label such as `3B`, and who made it, e.g. `Opus`, `Codex`).
- Layout (chosen from three options): **sidebar of categories on the left; on the right the newest round on top, older rounds below it and visually faded.** The newest round of a category carries a `NEW` badge. Each category in the sidebar shows its number of rounds. On a phone the sidebar becomes a row of category chips at the top (builder's call on the exact form).
- A variant is **a screenshot, with the HTML mockup behind it when there is one**: clicking the screenshot opens the HTML mockup (full screen / new tab) so it can be clicked through.
- **Automatic:** whenever Claude makes mockups, the skill files them as a new round and gives the link. Typing `/mockup-gallery` opens (serves) the gallery.
- **Viewing:** at the computer via `localhost`. Only when the user explicitly asks for a link (e.g. to view on a phone), via a temporary `cloudflared` quick tunnel; the tunnel is stopped when the user is done looking. A public link is never started on its own initiative: in client projects it could expose real data.
- Everything in English: skill, gallery UI, README, docs.

## Non-goals

- No voting, picking or note-taking on the page. Feedback goes through the chat.
- No import of mockups that already exist in projects. The gallery starts empty and only collects new rounds.
- No central gallery across projects, no hosting, no accounts.
- No AI generation of mockups by the tool itself; it organises what Claude (or Codex) makes.

## Anti-goals (failure even if it works)

- A gallery that needs a build step, framework or `npm install` in the user's project.
- Labels that are unclear, so the user cannot tell which picture is which in a chat reply ("K-2 is better").
- A tunnel that stays open after the review, or a link that exposes more than the `mockups/` folder.
- Private paths, names or client data in the repo, the generated page or its tests.

## Constraints

- Distributed as a **Claude Code plugin** (like the owner's other public plugins): `.claude-plugin/plugin.json`, `skills/mockup-gallery/SKILL.md`, plus scripts.
- Scripts in **Node.js, no dependencies** (standard library only). Must work on macOS and Windows.
- The gallery page is **one self-contained `index.html`** (inline CSS/JS, data embedded) that also works when opened as a file.
- Mockups are part of the project and committed with it.
- Local servers use a temporary port that is not one of the owner's fixed project ports (the skill checks the port is free first).
- `cloudflared` is optional: if it is not installed, the skill says so and falls back to screenshots in the chat.
- Public-repo rules: MIT licence, tests with a CI badge, consistent code style, short README (English, owner's decision) with logo, one-line pitch and a screenshot of the gallery in use; a leak test that fails on private paths.

## Decided by the owner

- Name of the command: `/mockup-gallery`.
- Layout A (sidebar + stacked rounds), categories as the top level.
- Per project, inside `mockups/`, persisted via git.
- Variant = screenshot + optional HTML.
- Triggers automatically when making mockups.
- Only new mockups; no import.
- Labels are **round number + letter** (`3A`, `3B`), unique within a category, so "3B is better" is never ambiguous; across categories the user says "Logo 3B". The `add` command assigns them; the label is shown on every variant and in chat replies.
- All in English, built to be public.

## Claude's calls (can be changed)

- **Own folder:** the gallery lives in `mockups/gallery/`, not in `mockups/` itself, so older mockups in a project are never served or mixed in. All paths below are relative to that folder, and `serve`/`share` expose only it.
- **Data:** a manifest `gallery.json` is the source of truth; `index.html` is generated from it. Files live at `<category-slug>/round-<n>/` (one folder per variant: `<label>/screenshot.png` and/or `<label>/index.html`). Claude writes new mockups straight into the round folder.
- **Self-contained HTML:** an HTML mockup may only use files inside its own variant folder (or inline CSS/JS/fonts). The skill tells Claude to make them that way; `add` warns when an HTML file references something outside the variant folder.
- **Ports:** the server asks the OS for a free port (port 0). No list of fixed ports in the plugin; the owner's own rules handle that outside the repo.
- **When to tunnel:** the skill uses `localhost` by default; on Remote Control it sends screenshots in the chat, and it starts a tunnel only when the user explicitly asks for a link. The tunnel stops on `share --stop` when the user says they are done, and by itself after 2 hours as a safety net (pid file in the gallery folder, git-ignored).
- **Script:** `scripts/gallery.mjs` with sub-commands `add` (register a round: category, description, variants with label/author/image/html), `build` (regenerate `index.html`), `serve` (static server limited to `mockups/gallery/`, prints URL), `share` (start a `cloudflared` quick tunnel for the served URL, print the public link, and stop it on `share --stop`).
- **Screenshots:** when a variant only has HTML, the script can take the screenshot itself with the system Chrome or Edge in headless mode (`--screenshot`), at desktop size; the skill may also pass ready-made images.
- **Round numbering:** per category, starting at 1. Round time is when it was added.
- **`NEW`:** the newest round per category, if it is less than 24 hours old.
- **Look:** calm, Apple-like, light with dark-mode support, matching the approved layout mockup.

## Left to the builder

- Exact CLI flags and manifest field names.
- How the phone version of the sidebar behaves.
- Test layout (node:test is fine).
- The logo (light and dark version) and the README screenshot can come in a later round.
