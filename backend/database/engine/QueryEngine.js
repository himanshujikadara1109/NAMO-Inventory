/**
 * NAMO IMS — Query Engine
 * Provides MongoDB-like query interface over the custom storage engine.
 */

const { v4: uuidv4 } = require('uuid');

class QueryEngine {
  constructor(fileStore, indexManager) {
    this.fileStore = fileStore;
    this.indexManager = indexManager;
    // Cache: cache[companyId][collection] = { data: [], dirty: false }
    this.cache = {};
    // Write debounce timers
    this.writeTimers = {};
    // Collection schema definitions
    this.schemas = {};
  }

  defineSchema(collection, { indexedFields = [], ftFields = [] }) {
    this.schemas[collection] = { indexedFields, ftFields };
  }

  _getCache(companyId, collection) {
    if (!this.cache[companyId]) this.cache[companyId] = {};
    if (!this.cache[companyId][collection]) {
      const data = this.fileStore.read(companyId, collection);
      this.cache[companyId][collection] = { data, loaded: true };
      // Build index
      const schema = this.schemas[collection] || {};
      this.indexManager.buildIndex(
        companyId, collection, data,
        schema.indexedFields || [],
        schema.ftFields || []
      );
    }
    return this.cache[companyId][collection];
  }

  _scheduleWrite(companyId, collection) {
    const key = `${companyId}:${collection}`;
    if (this.writeTimers[key]) clearTimeout(this.writeTimers[key]);
    this.writeTimers[key] = setTimeout(() => {
      const cache = this.cache[companyId]?.[collection];
      if (cache) {
        this.fileStore.write(companyId, collection, cache.data);
      }
      delete this.writeTimers[key];
    }, 500);
  }

  _flushImmediate(companyId, collection) {
    const key = `${companyId}:${collection}`;
    if (this.writeTimers[key]) {
      clearTimeout(this.writeTimers[key]);
      delete this.writeTimers[key];
    }
    const cache = this.cache[companyId]?.[collection];
    if (cache) {
      this.fileStore.write(companyId, collection, cache.data);
    }
  }

  invalidateCache(companyId, collection) {
    if (this.cache[companyId]) {
      delete this.cache[companyId][collection];
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  insert(companyId, collection, doc) {
    const cache = this._getCache(companyId, collection);
    const schema = this.schemas[collection] || {};
    const record = {
      id: uuidv4(),
      ...doc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cache.data.push(record);
    this.indexManager.addRecord(companyId, collection, record, schema.indexedFields || [], schema.ftFields || []);
    this._scheduleWrite(companyId, collection);
    return record;
  }

  insertMany(companyId, collection, docs) {
    const cache = this._getCache(companyId, collection);
    const schema = this.schemas[collection] || {};
    const records = docs.map(doc => ({
      id: uuidv4(),
      ...doc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    cache.data.push(...records);
    for (const record of records) {
      this.indexManager.addRecord(companyId, collection, record, schema.indexedFields || [], schema.ftFields || []);
    }
    this._scheduleWrite(companyId, collection);
    return records;
  }

  findById(companyId, collection, id) {
    const cache = this._getCache(companyId, collection);
    return cache.data.find(r => r.id === id) || null;
  }

  findOne(companyId, collection, filter) {
    const results = this.find(companyId, collection, { filter, limit: 1 });
    return results[0] || null;
  }

  find(companyId, collection, options = {}) {
    const cache = this._getCache(companyId, collection);
    const { filter = {}, sort, limit, skip = 0, search, searchFields } = options;

    let data = cache.data;

    // Full-text search
    if (search && search.trim()) {
      const matchingIds = this.indexManager.fullTextSearch(companyId, collection, search);
      if (searchFields) {
        // Also do inline field search for fields not in FT index
        const q = search.toLowerCase();
        data = data.filter(r => {
          if (matchingIds.has(r.id)) return true;
          return searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(q));
        });
      } else {
        data = data.filter(r => matchingIds.has(r.id));
      }
    }

    // Filter
    data = data.filter(record => this._matchesFilter(record, filter));

    // Sort
    if (sort) {
      const [field, dir] = Array.isArray(sort) ? sort : [sort, 'asc'];
      const direction = dir === 'desc' ? -1 : 1;
      data = [...data].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * direction;
      });
    }

    // Pagination
    if (skip) data = data.slice(skip);
    if (limit) data = data.slice(0, limit);

    return data;
  }

  count(companyId, collection, filter = {}) {
    const cache = this._getCache(companyId, collection);
    return cache.data.filter(r => this._matchesFilter(r, filter)).length;
  }

  update(companyId, collection, id, updates) {
    const cache = this._getCache(companyId, collection);
    const schema = this.schemas[collection] || {};
    const idx = cache.data.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const old = cache.data[idx];
    const updated = { ...old, ...updates, id, updatedAt: new Date().toISOString() };
    cache.data[idx] = updated;
    this.indexManager.updateRecord(companyId, collection, old, updated, schema.indexedFields || [], schema.ftFields || []);
    this._scheduleWrite(companyId, collection);
    return updated;
  }

  delete(companyId, collection, id) {
    const cache = this._getCache(companyId, collection);
    const schema = this.schemas[collection] || {};
    const idx = cache.data.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const [removed] = cache.data.splice(idx, 1);
    this.indexManager.removeRecord(companyId, collection, removed, schema.indexedFields || [], schema.ftFields || []);
    this._scheduleWrite(companyId, collection);
    return true;
  }

  deleteMany(companyId, collection, filter) {
    const cache = this._getCache(companyId, collection);
    const schema = this.schemas[collection] || {};
    const toDelete = cache.data.filter(r => this._matchesFilter(r, filter));
    for (const record of toDelete) {
      this.indexManager.removeRecord(companyId, collection, record, schema.indexedFields || [], schema.ftFields || []);
    }
    cache.data = cache.data.filter(r => !this._matchesFilter(r, filter));
    this._scheduleWrite(companyId, collection);
    return toDelete.length;
  }

  // ─── Filter Engine ────────────────────────────────────────────────────────

  _matchesFilter(record, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$or') {
        if (!value.some(f => this._matchesFilter(record, f))) return false;
        continue;
      }
      if (key === '$and') {
        if (!value.every(f => this._matchesFilter(record, f))) return false;
        continue;
      }
      const recVal = record[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const ops = value;
        if ('$eq' in ops && recVal !== ops.$eq) return false;
        if ('$ne' in ops && recVal === ops.$ne) return false;
        if ('$gt' in ops && !(recVal > ops.$gt)) return false;
        if ('$gte' in ops && !(recVal >= ops.$gte)) return false;
        if ('$lt' in ops && !(recVal < ops.$lt)) return false;
        if ('$lte' in ops && !(recVal <= ops.$lte)) return false;
        if ('$in' in ops && !ops.$in.includes(recVal)) return false;
        if ('$nin' in ops && ops.$nin.includes(recVal)) return false;
        if ('$contains' in ops && !String(recVal ?? '').toLowerCase().includes(String(ops.$contains).toLowerCase())) return false;
        if ('$regex' in ops && !new RegExp(ops.$regex, 'i').test(String(recVal ?? ''))) return false;
      } else {
        if (Array.isArray(value)) {
          if (!value.includes(recVal)) return false;
        } else if (recVal !== value) {
          return false;
        }
      }
    }
    return true;
  }

  // ─── Aggregation ─────────────────────────────────────────────────────────

  aggregate(companyId, collection, options = {}) {
    const { filter = {}, groupBy, sum, count: doCount, avg } = options;
    const data = this.find(companyId, collection, { filter });
    if (!groupBy) {
      const result = {};
      if (sum) result.sum = data.reduce((acc, r) => acc + (Number(r[sum]) || 0), 0);
      if (doCount) result.count = data.length;
      if (avg) result.avg = data.length ? result.sum / data.length : 0;
      return result;
    }
    const groups = {};
    for (const record of data) {
      const key = record[groupBy] ?? 'unknown';
      if (!groups[key]) groups[key] = { _id: key, count: 0 };
      groups[key].count++;
      if (sum) groups[key][sum] = (groups[key][sum] || 0) + (Number(record[sum]) || 0);
    }
    return Object.values(groups);
  }

  flushAll() {
    for (const [companyId, collections] of Object.entries(this.cache)) {
      for (const collection of Object.keys(collections)) {
        this._flushImmediate(companyId, collection);
      }
    }
  }
}

module.exports = QueryEngine;
