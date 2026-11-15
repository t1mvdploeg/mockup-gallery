import fs from 'node:fs';
import path from 'node:path';

export const galleryDir = (projectRoot) => path.join(projectRoot, 'mockups', 'gallery');

export function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'category'
  );
}

export function loadManifest(dir) {
  const file = path.join(dir, 'gallery.json');
  if (!fs.existsSync(file)) {
    // dir is <projectRoot>/mockups/gallery
    return { version: 1, project: path.basename(path.resolve(dir, '..', '..')), categories: [] };
  }
  let m;
  try {
    m = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`gallery.json is not valid JSON: ${e.message}`);
  }
  validate(m);
  return m;
}

// These fields become folder names, so they must not be able to leave the gallery folder.
function validate(m) {
  for (const c of m?.categories ?? []) {
    if (typeof c.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug))
      throw new Error(`gallery.json has an invalid category slug: ${JSON.stringify(c.slug)}`);
    for (const r of c.rounds ?? []) {
      if (!Number.isInteger(r.n) || r.n < 1)
        throw new Error(`gallery.json has an invalid round number: ${JSON.stringify(r.n)}`);
      for (const v of r.variants ?? [])
        if (
          typeof v.label !== 'string' ||
          !/^\d+[A-Z]$/.test(v.label) ||
          !v.label.startsWith(String(r.n)) ||
          v.label.length !== String(r.n).length + 1
        )
          throw new Error(`gallery.json has an invalid variant label: ${JSON.stringify(v.label)}`);
    }
  }
}

export function saveManifest(dir, m) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gallery.json'), JSON.stringify(m, null, 2) + '\n');
}

export function addRound(m, { category, note, authors, now }) {
  if (authors.length > 26) throw new Error('A round has at most 26 variants');
  const categorySlug = slugify(category);
  let cat = m.categories.find((c) => c.slug === categorySlug);
  if (!cat) {
    cat = { name: category, slug: categorySlug, rounds: [] };
    m.categories.push(cat);
  }
  const n = cat.rounds.length ? Math.max(...cat.rounds.map((r) => r.n)) + 1 : 1;
  const round = {
    n,
    note,
    created: now.toISOString(),
    variants: authors.map((author, i) => ({ label: `${n}${String.fromCharCode(65 + i)}`, author })),
  };
  cat.rounds.push(round);
  return { round, categorySlug };
}

const inside = (dir, p) => {
  const rel = path.relative(path.resolve(dir), path.resolve(p));
  if (rel.startsWith('..') || path.isAbsolute(rel))
    throw new Error(`path escapes the gallery folder: ${p}`);
  return p;
};
export const roundDir = (dir, slug, n) => inside(dir, path.join(dir, slug, `round-${n}`));
export const variantDir = (dir, slug, n, label) =>
  inside(dir, path.join(roundDir(dir, slug, n), label));
