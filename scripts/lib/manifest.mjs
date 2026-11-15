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
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`gallery.json is not valid JSON: ${e.message}`);
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

export const roundDir = (dir, slug, n) => path.join(dir, slug, `round-${n}`);
export const variantDir = (dir, slug, n, label) => path.join(roundDir(dir, slug, n), label);
