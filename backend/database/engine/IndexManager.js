/**
 * NAMO IMS — Index Manager
 * Maintains in-memory indexes for fast lookups without a real DB.
 * Supports: exact match, range, full-text search.
 */

class IndexManager {
  constructor() {
    // indexes[companyId][collection][field] = Map(value -> Set(ids))
    this.indexes = {};
    // Full-text: ftIndex[companyId][collection] = Map(token -> Set(ids))
    this.ftIndex = {};
  }

  _ensureIndex(companyId, collection, field) {
    if (!this.indexes[companyId]) this.indexes[companyId] = {};
    if (!this.indexes[companyId][collection]) this.indexes[companyId][collection] = {};
    if (!this.indexes[companyId][collection][field]) this.indexes[companyId][collection][field] = new Map();
  }

  _ensureFtIndex(companyId, collection) {
    if (!this.ftIndex[companyId]) this.ftIndex[companyId] = {};
    if (!this.ftIndex[companyId][collection]) this.ftIndex[companyId][collection] = new Map();
  }

  buildIndex(companyId, collection, records, indexedFields, ftFields = []) {
    // Clear existing
    if (!this.indexes[companyId]) this.indexes[companyId] = {};
    this.indexes[companyId][collection] = {};
    if (!this.ftIndex[companyId]) this.ftIndex[companyId] = {};
    this.ftIndex[companyId][collection] = new Map();

    for (const field of indexedFields) {
      this.indexes[companyId][collection][field] = new Map();
    }

    for (const record of records) {
      const id = record.id;
      for (const field of indexedFields) {
        const val = String(record[field] ?? '').toLowerCase();
        this._ensureIndex(companyId, collection, field);
        const map = this.indexes[companyId][collection][field];
        if (!map.has(val)) map.set(val, new Set());
        map.get(val).add(id);
      }
      // Full-text indexing
      const ftMap = this.ftIndex[companyId][collection];
      for (const field of ftFields) {
        const text = String(record[field] ?? '').toLowerCase();
        const tokens = text.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          if (!ftMap.has(token)) ftMap.set(token, new Set());
          ftMap.get(token).add(id);
        }
      }
    }
  }

  updateRecord(companyId, collection, oldRecord, newRecord, indexedFields, ftFields = []) {
    this.removeRecord(companyId, collection, oldRecord, indexedFields, ftFields);
    this.addRecord(companyId, collection, newRecord, indexedFields, ftFields);
  }

  addRecord(companyId, collection, record, indexedFields, ftFields = []) {
    const id = record.id;
    for (const field of indexedFields) {
      this._ensureIndex(companyId, collection, field);
      const val = String(record[field] ?? '').toLowerCase();
      const map = this.indexes[companyId][collection][field];
      if (!map.has(val)) map.set(val, new Set());
      map.get(val).add(id);
    }
    this._ensureFtIndex(companyId, collection);
    const ftMap = this.ftIndex[companyId][collection];
    for (const field of ftFields) {
      const text = String(record[field] ?? '').toLowerCase();
      const tokens = text.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (!ftMap.has(token)) ftMap.set(token, new Set());
        ftMap.get(token).add(id);
      }
    }
  }

  removeRecord(companyId, collection, record, indexedFields, ftFields = []) {
    const id = record.id;
    for (const field of indexedFields) {
      if (!this.indexes[companyId]?.[collection]?.[field]) continue;
      const val = String(record[field] ?? '').toLowerCase();
      this.indexes[companyId][collection][field].get(val)?.delete(id);
    }
    const ftMap = this.ftIndex[companyId]?.[collection];
    if (ftMap) {
      for (const field of ftFields) {
        const text = String(record[field] ?? '').toLowerCase();
        const tokens = text.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          ftMap.get(token)?.delete(id);
        }
      }
    }
  }

  lookupByField(companyId, collection, field, value) {
    const map = this.indexes[companyId]?.[collection]?.[field];
    if (!map) return null;
    return map.get(String(value).toLowerCase()) ?? new Set();
  }

  fullTextSearch(companyId, collection, query) {
    const ftMap = this.ftIndex[companyId]?.[collection];
    if (!ftMap) return new Set();
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return new Set();
    let result = null;
    for (const token of tokens) {
      const matching = new Set();
      for (const [key, ids] of ftMap.entries()) {
        if (key.includes(token)) {
          for (const id of ids) matching.add(id);
        }
      }
      if (result === null) {
        result = matching;
      } else {
        // Union for multi-token (OR semantics for broader search)
        for (const id of matching) result.add(id);
      }
    }
    return result ?? new Set();
  }
}

module.exports = IndexManager;
