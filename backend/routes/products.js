/**
 * NAMO IMS — Products Routes
 * GET    /api/products            list + search + filter
 * POST   /api/products            create
 * GET    /api/products/:id        get one
 * PUT    /api/products/:id        update
 * DELETE /api/products/:id        delete
 * GET    /api/products/barcode/:code  lookup by barcode/sku
 * POST   /api/products/import     bulk import from xlsx
 */

const express = require('express');
const XLSX    = require('xlsx');
const db      = require('../database/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const upload   = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const {
      q, category, subCategory, brand, status,
      page = 1, limit = 50, sort = 'name', dir = 'asc',
      lowStock,
    } = req.query;

    const filter = {};
    if (category)    filter.category    = category;
    if (subCategory) filter.subCategory = subCategory;
    if (brand)       filter.brand       = brand;
    if (status)      filter.status      = status;

    const options = {
      filter,
      sort: [sort, dir],
      skip:  (Number(page) - 1) * Number(limit),
      limit: Number(limit),
    };
    if (q) options.search = q;

    let products = db.find(req.companyId, 'products', options);

    if (lowStock === 'true') {
      products = products.filter(p => Number(p.stock ?? 0) <= Number(p.minStock ?? 5));
    }

    const total = db.count(req.companyId, 'products', filter);

    return res.json({
      products,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('[Products/list]', err);
    return res.status(500).json({ error: 'Failed to list products' });
  }
});

// ─── GET /barcode/:code ───────────────────────────────────────────────────────
router.get('/barcode/:code', (req, res) => {
  const product =
    db.findOne(req.companyId, 'products', { barcode: req.params.code }) ||
    db.findOne(req.companyId, 'products', { sku: req.params.code });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  return res.json(product);
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const product = db.findById(req.companyId, 'products', req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  return res.json(product);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', auditLog('CREATE_PRODUCT', 'products'), (req, res) => {
  try {
    const {
      name, sku, barcode, category, subCategory, brand,
      description, price, costPrice, stock, minStock,
      status = 'active', unit = 'pcs',
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Product name is required' });
    if (price === undefined) return res.status(400).json({ error: 'Price is required' });

    // Check duplicate SKU
    if (sku && db.findOne(req.companyId, 'products', { sku })) {
      return res.status(409).json({ error: `SKU "${sku}" already exists` });
    }

    const product = db.insert(req.companyId, 'products', {
      name:        name.trim(),
      sku:         sku?.trim()      || '',
      barcode:     barcode?.trim()  || '',
      category:    category?.trim() || '',
      subCategory: subCategory?.trim() || '',
      brand:       brand?.trim()    || '',
      description: description?.trim() || '',
      price:       Number(price),
      costPrice:   Number(costPrice || 0),
      stock:       Number(stock     || 0),
      minStock:    Number(minStock  || 5),
      status,
      unit,
      companyId:   req.companyId,
    });

    const broadcast = req.app.get('broadcast');
    broadcast(req.companyId, 'PRODUCT_CREATED', { id: product.id, name: product.name });

    return res.status(201).json(product);
  } catch (err) {
    console.error('[Products/create]', err);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', auditLog('UPDATE_PRODUCT', 'products'), (req, res) => {
  try {
    const existing = db.findById(req.companyId, 'products', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // Check SKU uniqueness if changing
    if (req.body.sku && req.body.sku !== existing.sku) {
      const dup = db.findOne(req.companyId, 'products', { sku: req.body.sku });
      if (dup && dup.id !== req.params.id) {
        return res.status(409).json({ error: `SKU "${req.body.sku}" already exists` });
      }
    }

    const updated = db.update(req.companyId, 'products', req.params.id, {
      ...req.body,
      price:     req.body.price     !== undefined ? Number(req.body.price)     : existing.price,
      costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : existing.costPrice,
      stock:     req.body.stock     !== undefined ? Number(req.body.stock)     : existing.stock,
      minStock:  req.body.minStock  !== undefined ? Number(req.body.minStock)  : existing.minStock,
    });

    const broadcast = req.app.get('broadcast');
    broadcast(req.companyId, 'PRODUCT_UPDATED', { id: updated.id });

    return res.json(updated);
  } catch (err) {
    console.error('[Products/update]', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin', 'manager'), auditLog('DELETE_PRODUCT', 'products'), (req, res) => {
  const existing = db.findById(req.companyId, 'products', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  db.delete(req.companyId, 'products', req.params.id);
  return res.json({ message: 'Product deleted', id: req.params.id });
});

// ─── POST /import ─────────────────────────────────────────────────────────────
router.post('/import', requireRole('admin', 'manager'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        const name  = String(row.name || row.Name || '').trim();
        const sku   = String(row.sku  || row.SKU  || '').trim();
        if (!name) { results.skipped++; continue; }
        if (sku && db.findOne(req.companyId, 'products', { sku })) {
          results.skipped++;
          continue;
        }
        db.insert(req.companyId, 'products', {
          name,
          sku,
          barcode:     String(row.barcode    || row.Barcode    || '').trim(),
          category:    String(row.category   || row.Category   || '').trim(),
          subCategory: String(row.subCategory || '').trim(),
          brand:       String(row.brand      || row.Brand      || '').trim(),
          description: String(row.description || '').trim(),
          price:       Number(row.price      || row.Price      || 0),
          costPrice:   Number(row.costPrice  || row.CostPrice  || 0),
          stock:       Number(row.stock      || row.Stock      || 0),
          minStock:    Number(row.minStock   || 5),
          status:      'active',
          unit:        String(row.unit || 'pcs').trim(),
          companyId:   req.companyId,
        });
        results.created++;
      } catch (rowErr) {
        results.errors.push(rowErr.message);
      }
    }

    return res.json({ message: 'Import complete', ...results });
  } catch (err) {
    console.error('[Products/import]', err);
    return res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;
