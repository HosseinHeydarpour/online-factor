const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const vendorDir = path.join(rootDir, 'assets', 'vendor');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-vendor] Source file not found: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`[copy-vendor] Copied: ${path.relative(rootDir, dest)}`);
  return true;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-vendor] Source dir not found: ${src}`);
    return;
  }
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log('[copy-vendor] Starting vendor assets extraction from node_modules...');
  ensureDir(vendorDir);

  // 1. jQuery
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'jquery', 'dist', 'jquery.min.js'),
    path.join(vendorDir, 'jquery.min.js')
  );

  // 2. Chart.js (UMD)
  const chartUmdMin = path.join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js');
  const chartUmd = path.join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
  copyFileSafe(
    fs.existsSync(chartUmdMin) ? chartUmdMin : chartUmd,
    path.join(vendorDir, 'chart.umd.min.js')
  );

  // 3. Persian Date
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'persian-date', 'dist', 'persian-date.min.js'),
    path.join(vendorDir, 'persian-date', 'persian-date.min.js')
  );

  // 4. Persian Datepicker (JS & CSS)
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'persian-datepicker', 'dist', 'js', 'persian-datepicker.min.js'),
    path.join(vendorDir, 'persian-datepicker', 'persian-datepicker.min.js')
  );
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'persian-datepicker', 'dist', 'css', 'persian-datepicker.min.css'),
    path.join(vendorDir, 'persian-datepicker', 'persian-datepicker.min.css')
  );

  // 5. Quill
  const quillJs = path.join(rootDir, 'node_modules', 'quill', 'dist', 'quill.js');
  const quillMinJs = path.join(rootDir, 'node_modules', 'quill', 'dist', 'quill.min.js');
  copyFileSafe(
    fs.existsSync(quillJs) ? quillJs : quillMinJs,
    path.join(vendorDir, 'quill', 'quill.js')
  );
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'quill', 'dist', 'quill.snow.css'),
    path.join(vendorDir, 'quill', 'quill.snow.css')
  );

  // 6. QRCode (bundled via esbuild for browser window.QRCode)
  const qrcodeBrowserEntry = path.join(rootDir, 'node_modules', 'qrcode', 'lib', 'browser.js');
  const qrcodeOut = path.join(vendorDir, 'qrcode.min.js');
  try {
    esbuild.buildSync({
      entryPoints: [qrcodeBrowserEntry],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'QRCode',
      outfile: qrcodeOut,
      footer: {
        js: 'if (typeof window !== "undefined") { window.QRCode = QRCode; }'
      }
    });
    console.log(`[copy-vendor] Bundled: assets/vendor/qrcode.min.js`);
  } catch (err) {
    console.error(`[copy-vendor] Failed to bundle qrcode:`, err);
  }

  // 7. XLSX
  copyFileSafe(
    path.join(rootDir, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'),
    path.join(vendorDir, 'xlsx.full.min.js')
  );

  // 8. Vazirmatn font & css
  const vazirNodeDir = path.join(rootDir, 'node_modules', 'vazirmatn');
  const vazirTargetDir = path.join(vendorDir, 'vazirmatn');
  ensureDir(vazirTargetDir);

  if (fs.existsSync(vazirNodeDir)) {
    const webfontsSrc = path.join(vazirNodeDir, 'fonts', 'webfonts');
    const webfontsDest = path.join(vazirTargetDir, 'fonts', 'webfonts');
    if (fs.existsSync(webfontsSrc)) {
      copyDirRecursive(webfontsSrc, webfontsDest);
      console.log(`[copy-vendor] Copied Vazirmatn webfonts woff2 files.`);
    }
    const vazirCss = path.join(vazirNodeDir, 'Vazirmatn-font-face.css');
    if (fs.existsSync(vazirCss)) {
      copyFileSafe(vazirCss, path.join(vazirTargetDir, 'Vazirmatn-font-face.css'));
    }
  }

  console.log('[copy-vendor] All vendor assets successfully installed in assets/vendor!');
}

main();
