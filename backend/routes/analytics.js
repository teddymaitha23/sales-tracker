// routes/analytics.js — summary, trend, categories, products

const express   = require('express');
const router    = express.Router();
const { getDB } = require('../database/db');

// ── GET /analytics/summary ────────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  const db = getDB();

  const totals = db.prepare(`
    SELECT COUNT(*) AS total_sales, SUM(total) AS total_revenue,
           AVG(total) AS avg_order_value, SUM(quantity) AS total_units
    FROM sales
  `).get();

  const bestProduct = db.prepare(`
    SELECT product, SUM(total) AS revenue, SUM(quantity) AS units
    FROM sales GROUP BY product ORDER BY revenue DESC LIMIT 1
  `).get();

  // Last two calendar months revenue
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', sale_date) AS month, SUM(total) AS revenue
    FROM sales
    WHERE sale_date >= date('now','-2 months','start of month')
    GROUP BY month ORDER BY month DESC LIMIT 2
  `).all();

  const thisMonth = monthly[0]?.revenue || 0;
  const lastMonth = monthly[1]?.revenue || 0;
  const growth    = lastMonth > 0
    ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)
    : null;

  res.json({
    success: true,
    data: {
      total_sales:        Number(totals.total_sales)    || 0,
      total_revenue:      +( (totals.total_revenue)    || 0).toFixed(2),
      avg_order_value:    +( (totals.avg_order_value)  || 0).toFixed(2),
      total_units:        Number(totals.total_units)   || 0,
      best_product:       bestProduct
        ? { ...bestProduct, revenue: +Number(bestProduct.revenue).toFixed(2) }
        : null,
      monthly_growth:         growth,
      this_month_revenue: +Number(thisMonth).toFixed(2),
    },
  });
});

// ── GET /analytics/trend ──────────────────────────────────────────────────────
router.get('/trend', (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT strftime('%Y-%m', sale_date) AS month,
           SUM(total)    AS revenue,
           COUNT(*)      AS sales_count,
           SUM(quantity) AS units_sold
    FROM sales
    WHERE sale_date >= date('now','-12 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  // Build a full 12-month array (fill gaps with zeroes)
  const filled = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const found = rows.find(r => r.month === key);
    filled.push({
      month:       key,
      label:       d.toLocaleDateString('en-US', { month:'short', year:'2-digit' }),
      revenue:     +Number(found?.revenue    || 0).toFixed(2),
      sales_count: Number(found?.sales_count || 0),
      units_sold:  Number(found?.units_sold  || 0),
    });
  }
  res.json({ success:true, data:filled });
});

// ── GET /analytics/categories ─────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT category, COUNT(*) AS sales_count, SUM(total) AS revenue, SUM(quantity) AS units
    FROM sales GROUP BY category ORDER BY revenue DESC
  `).all();

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);

  const data = rows.map(r => ({
    category:    r.category,
    sales_count: Number(r.sales_count),
    revenue:     +Number(r.revenue).toFixed(2),
    units:       Number(r.units),
    percentage:  totalRevenue > 0
      ? +(Number(r.revenue) / totalRevenue * 100).toFixed(1)
      : 0,
  }));

  res.json({ success:true, data });
});

// ── GET /analytics/products ───────────────────────────────────────────────────
router.get('/products', (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT product, category,
           COUNT(*)      AS transactions,
           SUM(quantity) AS units_sold,
           SUM(total)    AS revenue,
           AVG(price)    AS avg_price
    FROM sales GROUP BY product ORDER BY revenue DESC LIMIT 20
  `).all();

  const data = rows.map(r => ({
    product:      r.product,
    category:     r.category,
    transactions: Number(r.transactions),
    units_sold:   Number(r.units_sold),
    revenue:      +Number(r.revenue).toFixed(2),
    avg_price:    +Number(r.avg_price).toFixed(2),
  }));

  res.json({ success:true, data });
});

module.exports = router;
