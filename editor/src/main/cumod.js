/**
 * cumod.js — .cumod binary format read/write/verify
 *
 * Format:
 *   Magic: "CUMOD" (5 bytes)
 *   Version: 1 (uint8, 1 byte)
 *   Header length: uint32LE (4 bytes)
 *   Header JSON (variable length)
 *   Zip data (rest of file)
 *
 * Header JSON fields:
 *   - name, displayName, version, author
 *   - zipHash (SHA-256 hex of zip data)
 *   - signature (hex, optional — Ed25519 signature over zipHash)
 *   - certificate (JSON object, optional — developer cert signed by CA)
 *
 * Certificate format (JSON):
 *   {
 *     developer: "Name",
 *     publicKey: "hex-encoded Ed25519 public key",
 *     organisation: "Org",
 *     issuedAt: "ISO date",
 *     expiresAt: "ISO date",
 *     caSignature: "hex — CA's Ed25519 signature over the cert fields"
 *   }
 *
 * Trust chain:
 *   CA public key (bundled) -> verifies certificate.caSignature
 *   certificate.publicKey -> verifies header.signature over zipHash
 *   zipHash -> verifies zip integrity
 *   manifest hashes -> verifies extracted files
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAGIC = Buffer.from('CUMOD', 'ascii');
const FORMAT_VERSION = 1;
const HEADER_OFFSET = MAGIC.length + 1 + 4; // 5 + 1 + 4 = 10

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Create a .cumod file from a zip buffer and metadata.
 *
 * @param {Object} opts
 * @param {Buffer} opts.zipBuffer - The zip data
 * @param {string} opts.name - Module name
 * @param {string} opts.displayName - Display name
 * @param {string} opts.version - Module version
 * @param {string} [opts.author] - Author name
 * @param {Buffer} [opts.privateKey] - Ed25519 private key (raw 32 bytes or KeyObject)
 * @param {Object} [opts.certificate] - Developer certificate JSON object
 * @param {string} [opts.externalSignature] - Pre-computed hex signature (YubiKey/FIPS 140)
 * @param {Object} [opts.externalCertificate] - Certificate JSON for external signature
 * @returns {Buffer} The .cumod file buffer
 */
function createCumod(opts) {
    const { zipBuffer, name, displayName, version, author } = opts;

    // Compute zip hash
    const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

    // Build header
    const header = {
        name,
        displayName: displayName || name,
        version: version || '1.0.0',
        author: author || '',
        zipHash
    };

    // Sign if key + cert provided
    if (opts.privateKey && opts.certificate) {
        const signature = ed25519Sign(opts.privateKey, zipHash);
        header.signature = signature;
        header.certificate = opts.certificate;
    } else if (opts.externalSignature && opts.externalCertificate) {
        header.signature = opts.externalSignature;
        header.certificate = opts.externalCertificate;
    }

    const headerJson = Buffer.from(JSON.stringify(header), 'utf8');

    // Assemble binary
    const buf = Buffer.alloc(HEADER_OFFSET + headerJson.length + zipBuffer.length);
    let offset = 0;

    MAGIC.copy(buf, offset);
    offset += MAGIC.length;

    buf.writeUInt8(FORMAT_VERSION, offset);
    offset += 1;

    buf.writeUInt32LE(headerJson.length, offset);
    offset += 4;

    headerJson.copy(buf, offset);
    offset += headerJson.length;

    zipBuffer.copy(buf, offset);

    return buf;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Parse a .cumod file buffer.
 *
 * @param {Buffer} buf - The .cumod file contents
 * @returns {{ header: Object, zipBuffer: Buffer }}
 */
function parseCumod(buf) {
    if (buf.length < HEADER_OFFSET) {
        throw new Error('File too small to be a valid .cumod');
    }
    if (buf.slice(0, MAGIC.length).toString('ascii') !== 'CUMOD') {
        throw new Error('Invalid .cumod file: bad magic bytes');
    }

    const version = buf.readUInt8(MAGIC.length);
    if (version !== FORMAT_VERSION) {
        throw new Error(`Unsupported .cumod version: ${version} (expected ${FORMAT_VERSION})`);
    }

    const headerLen = buf.readUInt32LE(MAGIC.length + 1);
    if (HEADER_OFFSET + headerLen > buf.length) {
        throw new Error('Invalid .cumod: header length exceeds file size');
    }

    const headerJson = buf.slice(HEADER_OFFSET, HEADER_OFFSET + headerLen).toString('utf8');
    let header;
    try {
        header = JSON.parse(headerJson);
    } catch (e) {
        throw new Error('Invalid .cumod: malformed header JSON');
    }

    const zipBuffer = buf.slice(HEADER_OFFSET + headerLen);

    return { header, zipBuffer };
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} VerifyResult
 * @property {'verified'|'unverified'|'tampered'|'invalid'} status
 * @property {string} [developer]
 * @property {string} [reason]
 */

/**
 * Verify a parsed .cumod header against its zip data.
 *
 * @param {Object} header - Parsed header
 * @param {Buffer} zipBuffer - Zip data
 * @param {string} [caPublicKeyHex] - CA public key (hex, 32 bytes)
 * @returns {VerifyResult}
 */
function verifyCumod(header, zipBuffer, caPublicKeyHex) {
    // Step 1: Verify zip hash
    const computedHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
    if (computedHash !== header.zipHash) {
        return { status: 'tampered', reason: 'Zip hash mismatch — file has been modified' };
    }

    // Step 2: If no signature, it's unverified (but hash is OK)
    if (!header.signature || !header.certificate) {
        return { status: 'unverified' };
    }

    // Step 3: Verify certificate was signed by CA
    if (!caPublicKeyHex) {
        return { status: 'unverified', reason: 'No CA public key available for verification' };
    }

    const cert = header.certificate;

    // Validate certificate structure
    if (!cert.developer || !cert.publicKey || !cert.caSignature || !cert.issuedAt || !cert.expiresAt) {
        return { status: 'tampered', reason: 'Malformed developer certificate' };
    }

    // Check certificate is not issued in the future (sanity check only)
    const now = new Date();
    if (now < new Date(cert.issuedAt)) {
        return { status: 'tampered', reason: 'Developer certificate is not yet valid' };
    }

    // Verify CA signature over the certificate payload
    const certPayload = buildCertPayload(cert);
    const caKeyObj = ed25519PublicKeyFromHex(caPublicKeyHex);
    const caSignatureValid = ed25519Verify(caKeyObj, certPayload, cert.caSignature);

    if (!caSignatureValid) {
        return { status: 'tampered', reason: 'Certificate not signed by trusted CA' };
    }

    // Step 4: Verify module signature using developer's public key
    const devKeyObj = ed25519PublicKeyFromHex(cert.publicKey);
    const sigValid = ed25519Verify(devKeyObj, header.zipHash, header.signature);

    if (!sigValid) {
        return { status: 'tampered', reason: 'Module signature verification failed' };
    }

    return {
        status: 'verified',
        developer: cert.developer,
        certificate: {
            organisation: cert.organisation || null,
            website: cert.website || null,
            email: cert.email || null,
            issuedAt: cert.issuedAt,
            expiresAt: cert.expiresAt
        }
    };
}

/**
 * Verify extracted module files against a manifest.
 *
 * @param {string} moduleDir - Path to extracted module
 * @param {Object} manifest - manifest.json contents
 * @returns {{ valid: boolean, mismatches: string[] }}
 */
function verifyManifestFiles(moduleDir, manifest) {
    const mismatches = [];

    if (!manifest || !manifest.files) {
        return { valid: false, mismatches: ['No manifest files list'] };
    }

    for (const file of manifest.files) {
        const filePath = path.join(moduleDir, file.path);
        if (!fs.existsSync(filePath)) {
            mismatches.push(`Missing: ${file.path}`);
            continue;
        }
        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash !== file.hash) {
            mismatches.push(`Modified: ${file.path}`);
        }
    }

    return { valid: mismatches.length === 0, mismatches };
}

// ─── Ed25519 Helpers ──────────────────────────────────────────────────────────

/**
 * Sign a message string with an Ed25519 private key.
 * @param {crypto.KeyObject|Buffer} privateKey - Private key (KeyObject or raw 32-byte seed)
 * @param {string} message - Message to sign
 * @returns {string} Hex-encoded signature
 */
function ed25519Sign(privateKey, message) {
    let keyObj = privateKey;
    if (Buffer.isBuffer(privateKey) || typeof privateKey === 'string') {
        const seed = typeof privateKey === 'string' ? Buffer.from(privateKey, 'hex') : privateKey;
        keyObj = crypto.createPrivateKey({
            key: Buffer.concat([
                // Ed25519 PKCS8 prefix (16 bytes) + 04 20 (2 bytes) + 32-byte seed
                Buffer.from('302e020100300506032b657004220420', 'hex'),
                seed
            ]),
            format: 'der',
            type: 'pkcs8'
        });
    }
    const sig = crypto.sign(null, Buffer.from(message, 'utf8'), keyObj);
    return sig.toString('hex');
}

/**
 * Verify an Ed25519 signature.
 * @param {crypto.KeyObject} publicKey - Public KeyObject
 * @param {string} message - Original message
 * @param {string} signatureHex - Hex-encoded signature
 * @returns {boolean}
 */
function ed25519Verify(publicKey, message, signatureHex) {
    try {
        return crypto.verify(null, Buffer.from(message, 'utf8'), publicKey, Buffer.from(signatureHex, 'hex'));
    } catch (e) {
        return false;
    }
}

/**
 * Create a public KeyObject from a hex-encoded Ed25519 public key.
 * @param {string} hex - 32-byte public key as hex
 * @returns {crypto.KeyObject}
 */
function ed25519PublicKeyFromHex(hex) {
    const raw = Buffer.from(hex, 'hex');
    return crypto.createPublicKey({
        key: Buffer.concat([
            // Ed25519 SPKI prefix (12 bytes) + 32-byte key
            Buffer.from('302a300506032b6570032100', 'hex'),
            raw
        ]),
        format: 'der',
        type: 'spki'
    });
}

/**
 * Build the canonical payload string for a certificate (for signing/verification).
 * Deterministic: explicit field order, no whitespace, versioned.
 *
 * IMPORTANT: The field list and order here defines the signed content.
 * If you add fields in a future version, bump CERT_VERSION and handle both.
 */
const CERT_VERSION = 1;

function buildCertPayload(cert) {
    // Canonical field order — never reorder existing fields, only append in new versions
    const canonical = [
        ['v', CERT_VERSION],
        ['developer', cert.developer],
        ['publicKey', cert.publicKey],
        ['organisation', cert.organisation || ''],
        ['website', cert.website || ''],
        ['email', cert.email || ''],
        ['issuedAt', cert.issuedAt],
        ['expiresAt', cert.expiresAt]
    ];
    // Produce a stable string: array of pairs avoids JSON object key ordering issues
    return JSON.stringify(canonical);
}

// ─── CA Cert Path ─────────────────────────────────────────────────────────────

/**
 * Get the path to the bundled CA public key file.
 * @returns {string|null}
 */
function getCaKeyPath() {
    let caPath;
    try {
        const { app } = require('electron');
        if (app.isPackaged) {
            caPath = path.join(process.resourcesPath, 'ca.json');
        } else {
            caPath = path.resolve(__dirname, '..', '..', '..', 'tools', 'ca.json');
        }
    } catch (e) {
        caPath = path.resolve(__dirname, '..', '..', '..', 'tools', 'ca.json');
    }

    if (fs.existsSync(caPath)) return caPath;
    return null;
}

/**
 * Load the CA public key hex string.
 * @returns {string|null}
 */
function loadCaPublicKey() {
    const caPath = getCaKeyPath();
    if (!caPath) return null;
    try {
        const data = JSON.parse(fs.readFileSync(caPath, 'utf8'));
        return data.publicKey || null;
    } catch (e) {
        return null;
    }
}

// ─── Version Comparison ───────────────────────────────────────────────────────

/**
 * Compare two semver version strings (major.minor.patch).
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 *
 * @param {string} a - Version string (e.g. "1.4.0")
 * @param {string} b - Version string (e.g. "1.3.2")
 * @returns {number}
 */
function compareVersions(a, b) {
    const partsA = (a || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
    const partsB = (b || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < len; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

module.exports = {
    createCumod,
    parseCumod,
    verifyCumod,
    verifyManifestFiles,
    getCaKeyPath,
    loadCaPublicKey,
    ed25519Sign,
    ed25519Verify,
    ed25519PublicKeyFromHex,
    buildCertPayload,
    compareVersions,
    MAGIC,
    FORMAT_VERSION,
    CERT_VERSION
};
