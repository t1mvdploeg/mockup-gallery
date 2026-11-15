---
name: mockup-gallery
description: Use when making or comparing design mockups or variants (logos, icons, screens, layouts), when the user says "show the mockups" or "gallery", or types /mockup-gallery. Files every mockup as a new round in one browsable gallery per project.
---

# Mockup gallery

Every mockup goes into one gallery per project (`mockups/gallery/`), grouped by category and round. All commands:

`node "${CLAUDE_PLUGIN_ROOT}/scripts/gallery.mjs" <command>` (run from the project root, or pass `--project <root>`).

## Making mockups

1. **Before making mockups, register a round.** One author per variant (`Opus`, `Sonnet`, `Codex`, ...):

   `round --category "Logo" --note "<one line on what this round explores>" --authors Opus,Sonnet,Codex`

   It prints JSON with the round folder `dir` and the `labels` (`3A`, `3B`, ...). Each label has a folder `<dir>/<label>/`. Write each variant there as a self-contained `index.html` and/or `screenshot.png`. Self-contained means: only files inside that folder, or inline CSS/JS/fonts. One subagent per variant is fine.

2. **Run `build`.** It makes the screenshots that are missing and rebuilds `index.html`. Fix every `warning:` line and run `build` again.
3. **Run `serve` in the background** and give the user the printed localhost link.
4. **On a phone or Remote Control:** send the screenshots in the chat, each with its label above it. Never start `share` on your own initiative: a project may hold real data; only when the user explicitly asks for a link. Start it **in the background** (it keeps running for up to 2 hours) and give the user the `https://…trycloudflare.com` line it prints. If `share` says cloudflared is not installed, keep to screenshots in the chat.
5. **Refer to variants by label** in replies, with the category: "Logo 3B".
6. **Run `stop`** when the user is done looking, or at the end of the session. It ends the server and any public link.

`/mockup-gallery` on its own means: `build`, `serve`, and give the link.
