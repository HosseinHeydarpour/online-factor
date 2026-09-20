const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const content = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const regex = /(?:href|src)=["'](\.\/[^"']+)["']/g;
let match;
let allFound = true;
const checked = new Set();

while ((match = regex.exec(content)) !== null) {
  const relPath = match[1];
  if (checked.has(relPath)) continue;
  checked.add(relPath);

  const cleanPath = relPath.replace(/^\.\//, '');
  const fullPath = path.join(rootDir, cleanPath);
  const exists = fs.existsSync(fullPath);

  console.log(exists ? '✅ FOUND:' : '❌ MISSING:', relPath);
  if (!exists) allFound = false;
}

if (!allFound) {
  console.error('\n❌ Some files are missing in index.html!');
  process.exit(1);
} else {
  console.log('\n🌟 All local asset paths in index.html verified successfully!');
}

console.log('\n--- Checking Service Worker STATIC_ASSETS ---');
const swContent = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
const swMatch = swContent.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (swMatch) {
  const assets = swMatch[1].split('\n')
    .map(l => l.trim().replace(/[,'"]/g, ''))
    .filter(l => l && l !== './');
  let swOk = true;
  assets.forEach(rel => {
    const clean = rel.replace(/^\.\//, '');
    const exists = fs.existsSync(path.join(rootDir, clean));
    console.log(exists ? '✅ SW FOUND:' : '❌ SW MISSING:', rel);
    if (!exists) swOk = false;
  });
  if (!swOk) {
    console.error('❌ Some SW assets missing!');
    process.exit(1);
  } else {
    console.log('🌟 All Service Worker assets exist on disk!');
  }
}

