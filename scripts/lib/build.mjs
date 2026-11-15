import fs from 'node:fs';
import path from 'node:path';
import { galleryDir, loadManifest, variantDir } from './manifest.mjs';
import { renderGallery } from './render.mjs';
import { findOutsideRefs } from './check-html.mjs';
import { screenshot } from './shot.mjs';

export function buildGallery(projectRoot, { now = new Date(), shoot = screenshot } = {}) {
  const dir = galleryDir(projectRoot);
  const m = loadManifest(dir);
  const files = new Map();
  const warnings = [];
  for (const c of m.categories) {
    for (const r of c.rounds) {
      for (const v of r.variants) {
        const vdir = variantDir(dir, c.slug, r.n, v.label);
        const htmlFile = path.join(vdir, 'index.html');
        const pngFile = path.join(vdir, 'screenshot.png');
        const html = fs.existsSync(htmlFile);
        if (html) {
          const refs = findOutsideRefs(fs.readFileSync(htmlFile, 'utf8'), htmlFile, vdir);
          if (refs.length)
            warnings.push(
              `${c.name} ${v.label}: index.html uses files outside its folder: ${refs.join(', ')}`,
            );
        }
        const image = fs.existsSync(pngFile) || (html && shoot(htmlFile, pngFile) === true);
        files.set(`${c.slug}/round-${r.n}/${v.label}`, { image, html });
      }
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, renderGallery(m, files, { now }));
  fs.writeFileSync(path.join(dir, '.gitignore'), '.run.json\n');
  return { file, warnings };
}
