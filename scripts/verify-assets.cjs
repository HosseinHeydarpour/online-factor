
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

console.log('\n--- Checking Manifest Files & Icons ---');
const manifests = ['manifest.json', 'manifest-customer.json'];
manifests.forEach((mFile) => {
  const mPath = path.join(rootDir, mFile);
  if (!fs.existsSync(mPath)) {
    console.error(`❌ Manifest missing: ${mFile}`);
    allFound = false;
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    console.log(`✅ MANIFEST VALID: ${mFile} (Name: ${data.name})`);
    if (Array.isArray(data.icons)) {
      data.icons.forEach((icon) => {
        const iconClean = icon.src.replace(/^\.\//, '');
        const iconExists = fs.existsSync(path.join(rootDir, iconClean));
        console.log(iconExists ? '  ✅ ICON FOUND:' : '  ❌ ICON MISSING:', icon.src);
        if (!iconExists) allFound = false;
      });
    }
  } catch (err) {
    console.error(`❌ Error parsing ${mFile}:`, err.message);
    allFound = false;
  }
});

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
    if (!exists) {
      swOk = false;
      allFound = false;
    }
  });
  if (!swOk) {
    console.error('❌ Some SW assets missing!');
  } else {
    console.log('🌟 All Service Worker assets exist on disk!');
  }
}

console.log('\n--- Checking Data JSON Files ---');
const dataDir = path.join(rootDir, 'data');
if (fs.existsSync(dataDir)) {
  const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  jsonFiles.forEach(jf => {
    try {
      JSON.parse(fs.readFileSync(path.join(dataDir, jf), 'utf8'));
      console.log(`✅ DATA JSON VALID: data/${jf}`);
    } catch (e) {
      console.error(`❌ DATA JSON INVALID: data/${jf} - ${e.message}`);
      allFound = false;
    }
  });
}

if (!allFound) {
  console.error('\n❌ Build verification failed! Please fix missing assets.');
  process.exit(1);
} else {
  console.log('\n🚀 ALL ASSETS AND CHECKS PASSED FOR PRODUCTION & INSTALLATION!');
}

