/**
 * NAMO IMS — Database Instance
 * Singleton that wires up FileStore + IndexManager + QueryEngine
 * and registers all collection schemas.
 */

const path = require('path');
require('dotenv').config();

const FileStore = require('./engine/FileStore');
const IndexManager = require('./engine/IndexManager');
const QueryEngine = require('./engine/QueryEngine');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

const fileStore = new FileStore(dataDir);
const indexManager = new IndexManager();
const db = new QueryEngine(fileStore, indexManager);

// ─── Schema Definitions ────────────────────────────────────────────────────

db.defineSchema('companies', {
  indexedFields: ['email', 'slug'],
  ftFields: ['name', 'email'],
});

db.defineSchema('users', {
  indexedFields: ['email', 'companyId', 'role'],
  ftFields: ['name', 'email'],
});

db.defineSchema('orders', {
  indexedFields: ['orderNumber', 'status', 'paymentStatus', 'customerId', 'companyId'],
  ftFields: ['orderNumber', 'customerName', 'customerMobile', 'customerEmail', 'notes'],
});

db.defineSchema('products', {
  indexedFields: ['sku', 'barcode', 'category', 'subCategory', 'brand', 'status', 'companyId'],
  ftFields: ['name', 'sku', 'barcode', 'description', 'category', 'brand'],
});

db.defineSchema('customers', {
  indexedFields: ['mobile', 'email', 'companyId'],
  ftFields: ['name', 'mobile', 'email', 'address'],
});

db.defineSchema('audit_logs', {
  indexedFields: ['userId', 'action', 'collection', 'companyId'],
  ftFields: ['action', 'userId', 'userName'],
});

db.defineSchema('notifications', {
  indexedFields: ['userId', 'type', 'read', 'companyId'],
  ftFields: ['title', 'message'],
});

db.defineSchema('sessions', {
  indexedFields: ['userId', 'deviceId', 'companyId'],
  ftFields: [],
});

db.defineSchema('backups', {
  indexedFields: ['companyId', 'type'],
  ftFields: ['name'],
});

db.defineSchema('settings', {
  indexedFields: ['companyId'],
  ftFields: [],
});

db.fileStore = fileStore;

module.exports = db;
