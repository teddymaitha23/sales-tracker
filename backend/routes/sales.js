// routes/sales.js — CRUD endpoints for sales records

const express   = require('express');
const router    = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDB } = require('../database/db');

// Helper: extract first validation error
function firstError(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    res.status(400).json({ success: false, errors: errs.array() });
    return true;
  }
  return false;
}

// ── GET /sales ────────────────────────────────────────────────────────────────
router.get('/', [
  query('category').optional().isString().trim(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min:1, max:500 }).toInt(),
  query('offset').optional().isInt({ min:0 }).toInt(),
], (req, res) => {
  if (firstError(req, res)) return;
  const db = getDB();
  const { category, from, to, limit = 100, offset = 0 } = req.query;

  let sql = 'SELECT * FROM sales WHERE 1=1';
  const p = [];
  if (category) { sql += ' AND category = ?';    p.push(category); }
  if (from)     { sql += ' AND sale_date >= ?';  p.push(from); }
  if (to)       { sql += ' AND sale_date <= ?';  p.push(to); }
  sql += ' ORDER BY sale_date DESC, id DESC LIMIT ? OFFSET ?';
  p.push(limit, offset);

  const data  = db.prepare(sql).all(...p);
  const total = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
  res.json({ success:true, data, total, limit, offset });
});

// ── GET /sales/:id ────────────────────────────────────────────────────────────
router.get('/:id', [
  param('id').isInt({ min:1 }),
], (req, res) => {
  if (firstError(req, res)) return;
  const sale = getDB().prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ success:false, message:'Sale not found' });
  res.json({ success:true, data:sale });
});

// ── POST /sales ───────────────────────────────────────────────────────────────
router.post('/', [
  body('product').notEmpty().isString().trim().isLength({ min:2, max:100 }),
  body('category').notEmpty().isIn([
    'Electronics','Appliances','Footwear','Sports',
    'Home & Office','Clothing','Food & Beverage','Other',
  ]),
  body('quantity').isInt({ min:1, max:10000 }),
  body('price').isFloat({ min:0.01, max:999999 }),
  body('sale_date').isISO8601(),
  body('notes').optional({ nullable:true }).isString().trim().isLength({ max:255 }),
], (req, res) => {
  if (firstError(req, res)) return;
  const db = getDB();
  const { product, category, quantity, price, sale_date, notes = '' } = req.body;
  const total = +(Number(quantity) * Number(price)).toFixed(2);

  const result = db.prepare(
    `INSERT INTO sales (product,category,quantity,price,total,sale_date,notes)
     VALUES (?,?,?,?,?,?,?)`
  ).run([product.trim(), category, Number(quantity), Number(price), total, sale_date, notes]);

  const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success:true, data:newSale, message:'Sale created successfully' });
});

// ── DELETE /sales/:id ─────────────────────────────────────────────────────────
router.delete('/:id', [
  param('id').isInt({ min:1 }),
], (req, res) => {
  if (firstError(req, res)) return;
  const db   = getDB();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ success:false, message:'Sale not found' });
  db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  res.json({ success:true, message:'Sale deleted successfully', data:sale });
});

module.exports = router;
