#!/usr/bin/env node

/**
 * Bundles ui/src/app.js + ui/src/styles.css + ui/src/template.html
 * into a single self-contained mcp/dist/app.html (< 10 MiB, zero external requests).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'ui', 'src');
const OUT_DIR = path.join(ROOT, 'mcp', 'dist');
const OUT_FILE = path.join(OUT_DIR, 'app.html');

async function buildUi() {
  const templatePath = path.join(SRC_DIR, 'template.html');
  const stylesPath = path.join(SRC_DIR, 'styles.css');
  const entryPath = path.join(SRC_DIR, 'app.js');

  const template = fs.readFileSync(templatePath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  const bundled = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    write: false
  });

  if (!bundled.outputFiles || bundled.outputFiles.length === 0) {
    throw new Error('esbuild produced no output for ui/src/app.js');
  }

  // Prevent premature </script> termination inside inline HTML
  const jsCode = bundled.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');

  const finalHtml = template
    .replace('/*__STYLES__*/', () => styles)
    .replace('/*__SCRIPT__*/', () => jsCode);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, finalHtml, 'utf8');
  const sizeKb = (Buffer.byteLength(finalHtml, 'utf8') / 1024).toFixed(1);
  console.log(`Built ${OUT_FILE} (${sizeKb} KB)`);
}

buildUi().catch((err) => {
  console.error('UI build failed:', err);
  process.exit(1);
});
