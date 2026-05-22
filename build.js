#!/usr/bin/env node
/* =============================================================================
   BUILD · Bundle the modular project into a single distributable HTML file
   ---------------------------------------------------------------------------
   Strategy:
   - Read index.html
   - Inline every linked CSS file into <style> blocks
   - Resolve every ES module starting from src/js/app.js, strip `import` /
     `export` statements, and concat into a single classic <script> block
   - Write to public/ceo-daily-report.html
   ---------------------------------------------------------------------------
   Usage:  node build.js
   ============================================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'public');
const OUT_FILE = path.join(OUT_DIR, 'ceo-daily-report.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }

/* ---------- CSS inlining ---------- */
function inlineCSS(html) {
  return html.replace(
    /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g,
    (_, href) => {
      const full = path.join(ROOT, href);
      if (!fs.existsSync(full)) {
        console.warn('  [warn] CSS not found:', href);
        return '';
      }
      const css = read(full);
      return `<style>\n/* ${href} */\n${css}\n</style>`;
    }
  );
}

/* ---------- ES module bundling ---------- */
const moduleSeen = new Set();
const moduleCode = [];

function bundleModule(entry, fromDir) {
  const resolved = path.resolve(fromDir, entry);
  if (moduleSeen.has(resolved)) return;
  moduleSeen.add(resolved);

  if (!fs.existsSync(resolved)) {
    console.warn('  [warn] Module not found:', resolved);
    return;
  }

  let src = read(resolved);

  // Resolve nested imports first (depth-first so dependencies come first)
  const importRe = /import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;
  const deps = [];
  let m;
  while ((m = importRe.exec(src)) !== null) {
    deps.push(m[1]);
  }
  deps.forEach((dep) => bundleModule(dep, path.dirname(resolved)));

  // Strip all `import` statements
  src = src.replace(
    /import\s+(?:\{[^}]*\}\s+from\s+|[A-Za-z_$][\w$]*\s+from\s+|\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+)?['"][^'"]+['"]\s*;?/g,
    ''
  );

  // Strip `export` keywords but keep the declarations
  src = src
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+(const|let|var|function|class|async)\b/g, '$1')
    .replace(/\bexport\s*\{[^}]*\}\s*;?/g, '');

  moduleCode.push(`/* ========== ${path.relative(ROOT, resolved)} ========== */\n${src}`);
}

/* ---------- Main ---------- */
function main() {
  console.log('Building single-file distributable...');

  let html = read(INDEX);

  // Inline CSS
  console.log('  [1/3] Inlining CSS...');
  html = inlineCSS(html);

  // Bundle JS starting from app.js
  console.log('  [2/3] Bundling JS modules...');
  bundleModule('src/js/app.js', ROOT);

  const bundledJs = moduleCode.join('\n\n');

  // Replace the module script tag with an inline classic script
  html = html.replace(
    /<script\s+type="module"\s+src="[^"]+"\s*><\/script>/,
    `<script>\n(function(){\n${bundledJs}\n})();\n</script>`
  );

  // Ensure output directory
  console.log('  [3/3] Writing to', path.relative(ROOT, OUT_FILE));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`\n✓ Build complete (${sizeKB} KB)`);
  console.log(`  Output: ${path.relative(ROOT, OUT_FILE)}`);
}

try {
  main();
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
