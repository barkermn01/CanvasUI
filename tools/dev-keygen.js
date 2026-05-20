#!/usr/bin/env node
/**
 * dev-keygen.js — Developer generates an Ed25519 keypair + signing request.
 *
 * Usage: node tools/dev-keygen.js
 *
 * Outputs:
 *   developer.key  — Private key seed (hex, keep secret)
 *   developer.csr.json — Signing request (send to CA admin)
 *
 * No external dependencies. Pure Node.js crypto.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function prompt(rl, question, defaultVal) {
    return new Promise((resolve) => {
        const suffix = defaultVal ? ` [${defaultVal}]` : '';
        rl.question(`${question}${suffix}: `, (answer) => {
            resolve(answer.trim() || defaultVal || '');
        });
    });
}

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
    console.log('\u2551   CanvasUI Module Developer Key Gen      \u2551');
    console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
    console.log('');

    const devName = await prompt(rl, 'Developer Name');
    if (!devName) {
        console.error('Developer name is required.');
        rl.close();
        process.exit(1);
    }

    const organisation = await prompt(rl, 'Organisation', '');
    const website = await prompt(rl, 'Website (optional)', '');
    const email = await prompt(rl, 'Support Email (optional)', '');
    const outputDir = await prompt(rl, 'Output directory', '.');

    rl.close();

    console.log('');
    console.log('Generating Ed25519 keypair...');

    // Generate Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

    // Export raw bytes
    const pubRaw = publicKey.export({ type: 'spki', format: 'der' });
    const pubHex = pubRaw.slice(12).toString('hex');

    const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' });
    // Ed25519 PKCS8 DER: 16-byte prefix + 32-byte seed
    const seedHex = privRaw.slice(16).toString('hex');

    // Resolve output paths
    const resolvedDir = path.resolve(outputDir);
    if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
    }

    const keyPath = path.join(resolvedDir, 'developer.key');
    const csrPath = path.join(resolvedDir, 'developer.csr.json');

    // Write private key seed
    fs.writeFileSync(keyPath, seedHex, 'utf8');

    // Write CSR (signing request) — this gets sent to the CA admin
    const csr = {
        developer: devName,
        publicKey: pubHex,
        organisation: organisation || undefined,
        website: website || undefined,
        email: email || undefined,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString()
    };
    // Remove undefined fields
    Object.keys(csr).forEach(k => csr[k] === undefined && delete csr[k]);

    fs.writeFileSync(csrPath, JSON.stringify(csr, null, 2), 'utf8');

    console.log('');
    console.log('\u2705 Developer keypair generated!');
    console.log(`   Private key: ${keyPath}`);
    console.log(`   CSR:         ${csrPath}`);
    console.log(`   Public key:  ${pubHex}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Send developer.csr.json to the CA administrator');
    console.log('  2. They will run: node tools/ca-sign.js developer.csr.json');
    console.log('  3. You will receive a developer.cert.json back');
    console.log('  4. Use developer.key + developer.cert.json to sign modules');
    console.log('');
    console.log('\u26a0\ufe0f  Keep developer.key SECRET. Never share it or commit it.');
    console.log('');
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
