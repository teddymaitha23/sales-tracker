// database/db.js
// Pure-JS SQLite via sql.js — no native compilation required.
// Provides a synchronous-style API (.prepare().get/.all/.run) identical
// to better-sqlite3 so all route files work without changes.

const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'sales.db'));

// ─── Synchronous wrapper ─────────────────────────────────────────────────────
class SyncDB {
  constructor(sqlJs, buffer) {
    this._db   = new sqlJs.Database(buffer || null);
    this._path = DB_PATH;
  }

  _save() {
    const data = this._db.export();
    fs.writeFileSync(this._path, Buffer.from(data));
  }

  pragma(str)  { this._db.run(`PRAGMA ${str}`); }
  exec(sql)    { this._db.run(sql); this._save(); }

  prepare(sql) {
    const self = this;
    return {
      // Return first row as plain object, or null
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params.flat());
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        return row;
      },
      // Return all rows as array of plain objects
      all(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params.flat());
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      // Insert / update / delete — params may be object ({@key:val}) or array
      run(params) {
        const stmt = self._db.prepare(sql);
        if (params && typeof params === 'object' && !Array.isArray(params)) {
          // Named placeholders (@key or $key) → sql.js uses $key
          const mapped = {};
          for (const [k, v] of Object.entries(params)) {
            mapped[(k.startsWith('$') || k.startsWith('@') ? '$' + k.slice(1) : '$' + k)] = v;
          }
          stmt.run(mapped);
        } else {
          const arr = params === undefined ? [] : (Array.isArray(params) ? params : [params]);
          stmt.run(arr);
        }
        stmt.free();
        // IMPORTANT: query last_insert_rowid BEFORE _save() — db.export() resets it to 0
        const idStmt = self._db.prepare('SELECT last_insert_rowid() AS id');
        idStmt.step();
        const lastInsertRowid = idStmt.getAsObject().id ?? null;
        idStmt.free();
        self._save();
        return { lastInsertRowid };
      },
    };
  }

  // Wrap a function in a BEGIN/COMMIT transaction
  transaction(fn) {
    return (args) => {
      this._db.run('BEGIN');
      try   { fn(args); this._db.run('COMMIT'); }
      catch (e) { this._db.run('ROLLBACK'); throw e; }
      this._save();
    };
  }

  close() { this._db.close(); }
}

// ─── Module-level singleton ───────────────────────────────────────────────────
let _db = null;

function getDB() {
  if (!_db) throw new Error('DB not ready — await initDB() first');
  return _db;
}

async function initDB() {
  const sqlJs  = await initSqlJs();
  const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  _db = new SyncDB(sqlJs, buffer);

  _db.pragma('foreign_keys = ON');

  // Create sales table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product     TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      quantity    INTEGER NOT NULL,
      price       REAL    NOT NULL,
      total       REAL    NOT NULL,
      sale_date   TEXT    NOT NULL,
      notes       TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `);

  // Seed if empty
  const row = _db.prepare('SELECT COUNT(*) as count FROM sales').get();
  if (!row || Number(row.count) === 0) {
    _seed(_db);
    console.log('✅  Database seeded with 25 demo rows');
  }

  return _db;
}

function _seed(db) {
  const rows = [
    ['Wireless Headphones','Electronics',  3, 89.99, '2025-01-05','Online order'],
    ['Coffee Maker',       'Appliances',   1,149.99, '2025-01-08',''],
    ['Running Shoes',      'Footwear',     2, 79.99, '2025-01-15',''],
    ['Wireless Headphones','Electronics',  5, 89.99, '2025-02-03',''],
    ['Yoga Mat',           'Sports',       4, 34.99, '2025-02-10','Bulk order'],
    ['Smart Watch',        'Electronics',  2,199.99, '2025-02-18',''],
    ['Coffee Maker',       'Appliances',   3,149.99, '2025-03-01',''],
    ['Desk Lamp',          'Home & Office',6, 45.00, '2025-03-12',''],
    ['Smart Watch',        'Electronics',  1,199.99, '2025-03-20',''],
    ['Running Shoes',      'Footwear',     3, 79.99, '2025-04-05',''],
    ['Protein Powder',     'Sports',      10, 49.99, '2025-04-14','Recurring customer'],
    ['Wireless Headphones','Electronics',  4, 89.99, '2025-05-02',''],
    ['Coffee Maker',       'Appliances',   2,149.99, '2025-05-19',''],
    ['Yoga Mat',           'Sports',       7, 34.99, '2025-06-08',''],
    ['Desk Lamp',          'Home & Office',4, 45.00, '2025-06-22',''],
    ['Smart Watch',        'Electronics',  3,199.99, '2025-07-11',''],
    ['Protein Powder',     'Sports',       8, 49.99, '2025-07-25',''],
    ['Running Shoes',      'Footwear',     5, 79.99, '2025-08-03',''],
    ['Wireless Headphones','Electronics',  6, 89.99, '2025-09-14','Back to school promo'],
    ['Smart Watch',        'Electronics',  4,199.99, '2025-10-01',''],
    ['Coffee Maker',       'Appliances',   5,149.99, '2025-10-28','Holiday prep'],
    ['Yoga Mat',           'Sports',       9, 34.99, '2025-11-05',''],
    ['Desk Lamp',          'Home & Office',8, 45.00, '2025-11-15',''],
    ['Protein Powder',     'Sports',      12, 49.99, '2025-12-02',''],
    ['Smart Watch',        'Electronics',  6,199.99, '2025-12-20','Christmas rush'],
  ];

  const ins = `INSERT INTO sales (product,category,quantity,price,total,sale_date,notes)
               VALUES (?,?,?,?,?,?,?)`;
  db._db.run('BEGIN');
  for (const [product,category,quantity,price,sale_date,notes] of rows) {
    db._db.run(ins, [product, category, quantity, price, +(quantity*price).toFixed(2), sale_date, notes]);
  }
  db._db.run('COMMIT');
  db._save();
}

module.exports = { initDB, getDB };
