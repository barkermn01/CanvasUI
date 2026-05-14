/**
 * Build script for CanvasUI Stream Manager
 * 
 * Creates a release build that:
 * 1. Strips personal config (channel name, twitch ID, bot names)
 * 2. Packages the Electron app with electron-builder
 * 3. Includes all www/ files needed for the overlay
 * 4. Creates a Windows installer
 * 
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pngToIco = require('png-to-ico').default;

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(__dirname, 'dist');
const BUILD_WWW = path.join(__dirname, 'build-www');

// Auto-increment build number
const buildNumberFile = path.join(__dirname, 'buildnumber.json');
const buildData = JSON.parse(fs.readFileSync(buildNumberFile, 'utf8'));
buildData.build++;
fs.writeFileSync(buildNumberFile, JSON.stringify(buildData, null, 2) + '\n', 'utf8');

// Update package.json version — read existing version, append build number for display
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const SEMVER = pkg.version;
const VERSION = `${SEMVER}.${buildData.build}`;

console.log(`🔨 Building CanvasUI Stream Manager v${VERSION}...\n`);

// Step 0.5: Clean old dist
console.log('🧹 Cleaning old build files...');
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}

// Step 0: Convert icon.png to icon.ico
console.log('🎨 Converting icon...');
const iconPng = path.join(ROOT, 'icon.png');
const iconIco = path.join(__dirname, 'icon.ico');

async function build() {

const pngBuf = fs.readFileSync(iconPng);
const icoBuf = await pngToIco(pngBuf);
fs.writeFileSync(iconIco, icoBuf);

// Step 1: Use the example config for distribution
console.log('📝 Creating release config...');

const exampleConfigPath = path.join(ROOT, 'www', 'config.example.js');
const exampleContent = fs.readFileSync(exampleConfigPath, 'utf8');

// The example config uses plain JS (no const export needed for the release)
const releaseConfig = exampleContent;

// Step 2: Copy www/ to build directory
console.log('📂 Copying www/ files...');

if (fs.existsSync(BUILD_WWW)) {
    fs.rmSync(BUILD_WWW, { recursive: true });
}

copyDirSync(path.join(ROOT, 'www'), BUILD_WWW, ['media']);

// Write the cleaned config
fs.writeFileSync(path.join(BUILD_WWW, 'config.js'), releaseConfig, 'utf8');

// Also copy config.example.js
fs.copyFileSync(
    path.join(ROOT, 'www', 'config.example.js'),
    path.join(BUILD_WWW, 'config.example.js')
);

// Step 3: Copy config.json for the server
const serverConfig = {
    port: 31589,
    host: "127.0.0.1",
    webroot: "./www"
};
fs.writeFileSync(path.join(BUILD_WWW, '..', 'config.json'), JSON.stringify(serverConfig, null, 4), 'utf8');

console.log('✅ Release files prepared\n');

// Step 4: Run electron-builder
console.log('📦 Packaging with electron-builder...');
try {
    execSync('npx electron-builder --win --config electron-builder.json', {
        cwd: __dirname,
        stdio: 'inherit',
        env: { ...process.env, BUILD_NUMBER: String(buildData.build) }
    });
    console.log(`\n✅ Build complete! v${VERSION} — Check editor/dist/ for the installer.`);
} catch (e) {
    console.error('❌ Build failed:', e.message);
    process.exit(1);
}

// Cleanup
if (fs.existsSync(BUILD_WWW)) {
    fs.rmSync(BUILD_WWW, { recursive: true });
}

}

build().catch(e => { console.error('❌ Build failed:', e.message); process.exit(1); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyDirSync(src, dest, excludeDirs = []) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            if (excludeDirs.includes(entry.name)) {
                // Create the directory but don't copy contents
                fs.mkdirSync(destPath, { recursive: true });
            } else {
                copyDirSync(srcPath, destPath, excludeDirs);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
