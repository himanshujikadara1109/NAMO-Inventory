/**
 * NAMO IMS — Custom File-Based Storage Engine
 * FileStore: Core read/write/encrypt/compress operations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || 'namo_ims_32_char_encryption_key!!').padEnd(32, '!').slice(0, 32);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

class FileStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.walDir = path.join(dataDir, '_wal');
    this.ensureDir(dataDir);
    this.ensureDir(this.walDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getCollectionPath(companyId, collection) {
    const dir = path.join(this.dataDir, companyId);
    this.ensureDir(dir);
    return path.join(dir, `${collection}.namo`);
  }

  getWalPath(companyId, collection) {
    return path.join(this.walDir, `${companyId}_${collection}.wal`);
  }

  encrypt(data) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const json = JSON.stringify(data);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(encoded) {
    try {
      const buffer = Buffer.from(encoded, 'base64');
      const iv = buffer.slice(0, IV_LENGTH);
      const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = buffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
      const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const decompressed = zlib.gunzipSync(decrypted);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (err) {
      console.error('[FileStore] Decrypt error:', err.message);
      return [];
    }
  }

  read(companyId, collection) {
    const filePath = this.getCollectionPath(companyId, collection);
    if (!fs.existsSync(filePath)) return [];
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return this.decrypt(raw);
    } catch (err) {
      console.error(`[FileStore] Read error ${collection}:`, err.message);
      return this.recoverFromWal(companyId, collection);
    }
  }

  write(companyId, collection, data) {
    const filePath = this.getCollectionPath(companyId, collection);
    const walPath = this.getWalPath(companyId, collection);
    // Write WAL first
    fs.writeFileSync(walPath, JSON.stringify({ ts: Date.now(), data }), 'utf8');
    // Atomic write: temp file → rename
    const tempPath = filePath + '.tmp';
    const encrypted = this.encrypt(data);
    fs.writeFileSync(tempPath, encrypted, 'utf8');
    fs.renameSync(tempPath, filePath);
    // Clear WAL after successful write
    try { fs.unlinkSync(walPath); } catch {}
  }

  recoverFromWal(companyId, collection) {
    const walPath = this.getWalPath(companyId, collection);
    if (!fs.existsSync(walPath)) return [];
    try {
      const wal = JSON.parse(fs.readFileSync(walPath, 'utf8'));
      console.log(`[FileStore] Recovered ${collection} from WAL`);
      this.write(companyId, collection, wal.data);
      return wal.data;
    } catch {
      return [];
    }
  }

  exists(companyId) {
    return fs.existsSync(path.join(this.dataDir, companyId));
  }

  listCompanies() {
    if (!fs.existsSync(this.dataDir)) return [];
    return fs.readdirSync(this.dataDir)
      .filter(f => !f.startsWith('_') && fs.statSync(path.join(this.dataDir, f)).isDirectory());
  }

  deleteCollection(companyId, collection) {
    const filePath = this.getCollectionPath(companyId, collection);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  getCompanyDir(companyId) {
    return path.join(this.dataDir, companyId);
  }
}

module.exports = FileStore;
