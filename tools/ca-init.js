#!/usr/bin/env node
/**
 * ca-init.js — Generate a root CA Ed25519 keypair.
 *
 * Usage: node tools/ca-init.js
 *
 * Outputs:
 *   tools/ca.key  — Private key seed (hex, NEVER commit — .gitignored)
 *   tools/ca.json — Public key + metadata (bundled with app)
 *
 * No external dependencies. Pure Node.js crypto.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TOOLS_DIR = path.resolve(__dirname);
const CA_KEY_PATH = path.join(TOOLS_DIR, 'ca.key');
const CA_JSON_PATH = path.join(TOOLS_DIR, 'ca.json');

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
    console.log('\u2551   CanvasUI Module CA \u2014 Initialisation    \u2551');
    console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
    console.log('');
    console.log('This generates an Ed25519 keypair for your module CA.');
    console.log('The private key signs developer certificates.');
    console.log('The public key is bundled with the app to verify them.');
    console.log('');

    // Warn if ca.key already exists
    if (fs.existsSync(CA_KEY_PATH)) {
        const overwrite = await prompt(rl, '\u26a0\ufe0f  ca.key already exists. Overwrite? (yes/no)', 'no');
        if (overwrite.toLowerCase() !== 'yes') {
            console.log('Aborted.');
            rl.close();
            process.exit(0);
        }
    }

    // Check if ca.key is tracked by git
    try {
        const { execSync } = require('child_process');
        execSync('git ls-files --error-unmatch tools/ca.key', {
            cwd: path.resolve(TOOLS_DIR, '..'),
            stdio: 'pipe'
        });
        console.log('');
        console.log('\ud83d\udea8 WARNING: tools/ca.key is tracked by git!');
        console.log('   Add it to .gitignore immediately.');
        console.log('');
    } catch (e) {
        // Not tracked — good
    }

    const organisation = await prompt(rl, 'Organisation', 'CanvasUI');

    rl.close();

    console.log('');
    console.log('Generating Ed25519 keypair...');

    // Generate Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

    // Export raw bytes
    const pubRaw = publicKey.export({ type: 'spki', format: 'der' });
    // Ed25519 SPKI DER is 44 bytes: 12-byte prefix + 32-byte key
    const pubHex = pubRaw.slice(12).toString('hex');

    const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' });
    // Ed25519 PKCS8 DER: 16-byte prefix + 32-byte seed
    const seedHex = privRaw.slice(16).toString('hex');

    // Write private key (just the 32-byte seed as hex)
    fs.writeFileSync(CA_KEY_PATH, seedHex, 'utf8');

    // Write public key + metadata as JSON
    const caJson = {
        organisation,
        publicKey: pubHex,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString()
    };
    fs.writeFileSync(CA_JSON_PATH, JSON.stringify(caJson, null, 2), 'utf8');

    console.log('');
    console.log('\u2705 CA initialised successfully!');
    console.log(`   Private key: ${CA_KEY_PATH} (${seedHex.length / 2} bytes)`);
    console.log(`   Public key:  ${CA_JSON_PATH}`);
    console.log(`   Public key hex: ${pubHex}`);
    console.log('');
    console.log('\u26a0\ufe0f  NEVER commit ca.key to version control.');
    console.log('   ca.json is safe to commit \u2014 it only contains the public key.');
    console.log('');
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
