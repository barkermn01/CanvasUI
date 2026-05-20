#!/usr/bin/env node
/**
 * build-cumods.js — Generate signed .cumod packages for built-in modules.
 *
 * Usage: node tools/build-cumods.js [--skip=pngtuber,...]
 *
 * Requires:
 *   tools/ca.key  — CA private key (to sign as the CA directly for built-in modules)
 *   tools/ca.json — CA public key metadata
 *
 * Outputs:
 *   www/modules/.packages/<name>.cumod for each built-in module
 *
 * For built-in modules, we sign directly with the CA key (the CA *is* the developer
 * for official modules). The certificate embeds the CA's own public key as the
 * developer key, making the trust chain: CA signs cert -> cert.publicKey signs module.
 *
 * No external dependencies. Pure Node.js crypto.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Add the editor src to require path for cumod.js
const cumod = require('../editor/src/main/cumod.js');
const AdmZip = require('../editor/node_modules/adm-zip');

const TOOLS_DIR = path.resolve(__dirname);
const ROOT = path.resolve(TOOLS_DIR, '..');
const MODULES_DIR = path.join(ROOT, 'www', 'modules');
const PACKAGES_DIR = path.join(MODULES_DIR, '.packages');
const CA_KEY_PATH = path.join(TOOLS_DIR, 'ca.key');
const CA_JSON_PATH = path.join(TOOLS_DIR, 'ca.json');
const PKG_PATH = path.join(ROOT, 'editor', 'package.json');

const BUILT_IN_MODULES = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(MODULES_DIR, e.name, 'info.json')))
    .map(e => e.name);

// Read app version from editor/package.json
const APP_VERSION = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')).version;

function getAllFiles(dir, base = '') {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            results.push(...getAllFiles(path.join(dir, entry.name), rel));
        } else {
            results.push(rel);
        }
    }
    return results;
}

function hashFile(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function main() {
    // Parse --skip argument
    const skipArg = process.argv.find(a => a.startsWith('--skip='));
    const skipModules = skipArg ? skipArg.split('=')[1].split(',').map(s => s.trim()) : [];

    // Validate CA files exist
    if (!fs.existsSync(CA_KEY_PATH)) {
        console.error('Error: CA private key not found (tools/ca.key).');
        console.error('Run "node tools/ca-init.js" first.');
        process.exit(1);
    }
    if (!fs.existsSync(CA_JSON_PATH)) {
        console.error('Error: CA public key not found (tools/ca.json).');
        console.error('Run "node tools/ca-init.js" first.');
        process.exit(1);
    }

    // Load CA key
    const seedHex = fs.readFileSync(CA_KEY_PATH, 'utf8').trim();
    const seed = Buffer.from(seedHex, 'hex');
    const caPrivateKey = crypto.createPrivateKey({
        key: Buffer.concat([
            Buffer.from('302e020100300506032b657004220420', 'hex'),
            seed
        ]),
        format: 'der',
        type: 'pkcs8'
    });

    // Derive CA public key from private key
    const caJson = JSON.parse(fs.readFileSync(CA_JSON_PATH, 'utf8'));
    const caPubHex = caJson.publicKey;

    // For built-in modules, the CA itself is the "developer"
    // We create a self-referencing certificate where the CA signs its own public key
    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years

    const cert = {
        certVersion: cumod.CERT_VERSION,
        developer: caJson.organisation || 'CanvasUI',
        publicKey: caPubHex,
        organisation: caJson.organisation || 'CanvasUI',
        issuedAt: now.toISOString(),
        expiresAt: expires.toISOString()
    };

    // CA signs its own certificate
    const certPayload = cumod.buildCertPayload(cert);
    const certSig = crypto.sign(null, Buffer.from(certPayload, 'utf8'), caPrivateKey);
    cert.caSignature = certSig.toString('hex');

    // Ensure .packages directory exists
    if (!fs.existsSync(PACKAGES_DIR)) {
        fs.mkdirSync(PACKAGES_DIR, { recursive: true });
    }

    console.log(`Building .cumod packages for built-in modules...`);
    console.log(`  Skipping: ${skipModules.length ? skipModules.join(', ') : '(none)'}`);
    console.log('');

    let built = 0;
    let skipped = 0;

    for (const moduleName of BUILT_IN_MODULES) {
        if (skipModules.includes(moduleName)) {
            console.log(`  ⏭  ${moduleName} (skipped)`);
            skipped++;
            continue;
        }

        const moduleDir = path.join(MODULES_DIR, moduleName);
        if (!fs.existsSync(moduleDir)) {
            console.log(`  ⚠️  ${moduleName} (directory not found)`);
            continue;
        }

        // Read info.json and stamp version fields
        const infoPath = path.join(moduleDir, 'info.json');
        if (!fs.existsSync(infoPath)) {
            console.log(`  ⚠️  ${moduleName} (no info.json)`);
            continue;
        }
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        info.version = APP_VERSION;
        info.builtForVersion = APP_VERSION;
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 4) + '\n', 'utf8');

        // Get all files
        const files = getAllFiles(moduleDir);

        // Generate manifest
        const manifest = {
            name: moduleName,
            displayName: info.displayName || moduleName,
            version: APP_VERSION,
            description: info.description || '',
            files: files.map(f => ({
                path: f,
                hash: hashFile(path.join(moduleDir, f))
            }))
        };

        // Create zip
        const zip = new AdmZip();
        for (const file of files) {
            const fullPath = path.join(moduleDir, file);
            const dirInZip = path.dirname(file) === '.' ? '' : path.dirname(file).replace(/\\/g, '/');
            zip.addLocalFile(fullPath, dirInZip);
        }
        zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

        const zipBuffer = zip.toBuffer();

        // Create signed .cumod
        const cumodBuffer = cumod.createCumod({
            zipBuffer,
            name: moduleName,
            displayName: info.displayName || moduleName,
            version: APP_VERSION,
            author: caJson.organisation || 'CanvasUI',
            privateKey: caPrivateKey,
            certificate: cert
        });

        // Write to .packages/
        const outputPath = path.join(PACKAGES_DIR, `${moduleName}.cumod`);
        fs.writeFileSync(outputPath, cumodBuffer);

        const sizeKB = (cumodBuffer.length / 1024).toFixed(1);
        console.log(`  ✅ ${moduleName} (${sizeKB} KB)`);
        built++;
    }

    console.log('');
    console.log(`Done! Built: ${built}, Skipped: ${skipped}`);
    console.log(`Packages: ${PACKAGES_DIR}`);
}

main();
