import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const includeExt = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.mjs', '.cjs', '.svg']);
const skipDirs = new Set(['node_modules', '.git', 'dist']);
const extraFiles = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs', 'vite.config.js', 'vite.config.ts', 'index.html'];

const blackTailwind = /\b(?:text|bg|border|ring|shadow|fill|stroke|divide|placeholder|decoration|outline|caret|accent|from|to|via)-black(?:\/\d+)?\b/g;
const explicit = /#000000\b|#000\b|#0a0a0a\b|#111827\b|#111\b|#1a1a1a\b|#1f2937\b|\brgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|\brgba\(\s*0\s*,\s*0\s*,\s*0\b|\bhsl\(\s*0\s*,\s*0%\s*,\s*0%\s*\)|\b(?:color|background(?:-color)?|border-color|outline-color|fill|stroke)\s*:\s*black\b/gi;
const hexRe = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function isNearBlackHex(hex) {
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return r <= 34 && g <= 34 && b <= 34;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (includeExt.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = new Set(walk(path.join(root, 'src')));
for (const f of extraFiles) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) files.add(p);
}

const failures = [];
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const matches = [];
    for (const m of line.matchAll(blackTailwind)) matches.push(m[0]);
    for (const m of line.matchAll(explicit)) matches.push(m[0]);
    for (const m of line.matchAll(hexRe)) if (isNearBlackHex(m[1])) matches.push('#' + m[1]);
    if (matches.length) failures.push(`${rel}:${i + 1}: ${[...new Set(matches)].join(', ')} | ${line.trim()}`);
  });
}

if (failures.length) {
  console.error('Black/near-black values found:');
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log('check:no-black passed (src, configs, index.html)');
