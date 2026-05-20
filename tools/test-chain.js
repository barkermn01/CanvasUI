#!/usr/bin/env node
/**
 * Quick integration test for the Ed25519 signing chain.
 * Run: node tools/test-chain.js
 */
const crypto = require('crypto');
const cumod = require('../editor/src/main/cumod.js');

// 1. Generate CA keypair
const caKp = crypto.generateKeyPairSync('ed25519');
const caPubHex = caKp.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('hex');
console.log('CA public key:', caPubHex.slice(0, 16) + '...');

// 2. Generate developer keypair
const devKp = crypto.generateKeyPairSync('ed25519');
const devPubHex = devKp.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('hex');
console.log('Dev public key:', devPubHex.slice(0, 16) + '...');

// 3. CA signs developer certificate
const now = new Date();
const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
const cert = {
    certVersion: 1,
    developer: 'TestDev',
    publicKey: devPubHex,
    organisation: 'TestOrg',
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString()
};
const payload = cumod.buildCertPayload(cert);
const caSig = crypto.sign(null, Buffer.from(payload, 'utf8'), caKp.privateKey);
cert.caSignature = caSig.toString('hex');
console.log('Certificate signed by CA');

// 4. Developer creates a signed .cumod
const zipData = Buffer.from('PK\x03\x04 fake zip content for testing');
const cumodBuf = cumod.createCumod({
    zipBuffer: zipData,
    name: 'test-module',
    displayName: 'Test Module',
    version: '1.0.0',
    author: 'TestDev',
    privateKey: devKp.privateKey,
    certificate: cert
});
console.log('.cumod created:', cumodBuf.length, 'bytes');

// 5. Parse and verify
const { header, zipBuffer } = cumod.parseCumod(cumodBuf);
const result = cumod.verifyCumod(header, zipBuffer, caPubHex);
console.log('Verification:', JSON.stringify(result));

// 6. Test tamper detection
const tampered = Buffer.from(cumodBuf);
tampered[tampered.length - 1] ^= 0xFF;
const { header: h2, zipBuffer: z2 } = cumod.parseCumod(tampered);
const result2 = cumod.verifyCumod(h2, z2, caPubHex);
console.log('Tampered:', JSON.stringify(result2));

// 7. Test unsigned module
const unsignedBuf = cumod.createCumod({
    zipBuffer: zipData,
    name: 'unsigned-mod',
    displayName: 'Unsigned',
    version: '1.0.0'
});
const { header: h3, zipBuffer: z3 } = cumod.parseCumod(unsignedBuf);
const result3 = cumod.verifyCumod(h3, z3, caPubHex);
console.log('Unsigned:', JSON.stringify(result3));

// 8. Test wrong CA key
const fakeCA = crypto.generateKeyPairSync('ed25519');
const fakePub = fakeCA.publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('hex');
const result4 = cumod.verifyCumod(header, zipBuffer, fakePub);
console.log('Wrong CA:', JSON.stringify(result4));

console.log('\nAll tests passed!');
