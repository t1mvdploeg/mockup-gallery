import path from 'node:path';

const REF =
  /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))|url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;

// References that resolve outside variantDir, or are absolute file paths.
export function findOutsideRefs(html, htmlFile, variantDir) {
  const out = [];
  for (const m of html.matchAll(REF)) {
    const ref = m
      .slice(1)
      .find((g) => g !== undefined)
      .trim();
    if (!ref || ref.startsWith('#') || ref.startsWith('//') || out.includes(ref)) continue;
    const isDrive = /^[a-z]:[\\/]/i.test(ref);
    // Any other scheme (http:, data:, mailto:, …) is not a local file; file: is.
    if (!isDrive && /^[a-z][a-z0-9+.-]*:/i.test(ref) && !/^file:/i.test(ref)) continue;
    let bad = isDrive || /^([\\/]|file:)/i.test(ref);
    if (!bad) {
      const rel = ref.split(/[?#]/)[0];
      let target;
      try {
        target = path.resolve(path.dirname(htmlFile), decodeURI(rel));
      } catch {
        target = path.resolve(path.dirname(htmlFile), rel);
      }
      const r = path.relative(variantDir, target);
      bad = r === '..' || r.startsWith('..' + path.sep) || path.isAbsolute(r);
    }
    if (bad) out.push(ref);
  }
  return out;
}
