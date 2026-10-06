import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================================================
// RELATIONAL DATABASE ENGINE (shopping_system.db)
// Enforces tables, check constraints, foreign keys, and views
// ============================================================================

const DB_PATH = path.join(__dirname, 'shopping_system.db');

// Connect to SQLite Database
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

// Helper to initialize schema and seed data if database is empty
function ensureDatabaseSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Customer (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      address TEXT,
      city TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Category (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS Product (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      price REAL NOT NULL CHECK(price > 0),
      stock_qty INTEGER NOT NULL CHECK(stock_qty >= 0),
      category_id INTEGER NOT NULL REFERENCES Category(category_id)
    );

    CREATE TABLE IF NOT EXISTS Orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES Customer(customer_id),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Placed' CHECK(status IN ('Placed', 'Shipped', 'Delivered', 'Cancelled'))
    );

    CREATE TABLE IF NOT EXISTS Order_Item (
      order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES Product(product_id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price > 0),
      PRIMARY KEY (order_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS Payment (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES Orders(order_id) ON DELETE CASCADE,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('UPI', 'Credit Card', 'COD')),
      payment_date TEXT,
      amount REAL NOT NULL CHECK(amount >= 0),
      payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Paid', 'Failed'))
    );

    CREATE VIEW IF NOT EXISTS order_summary AS
    SELECT 
        o.order_id,
        c.name AS customer,
        o.order_date,
        o.status,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS order_total,
        COALESCE(p.payment_status, 'Pending') AS payment_status
    FROM Orders o
    JOIN Customer c ON o.customer_id = c.customer_id
    LEFT JOIN Order_Item oi ON o.order_id = oi.order_id
    LEFT JOIN Payment p ON o.order_id = p.order_id
    GROUP BY o.order_id, c.name, o.order_date, o.status, p.payment_status;
  `);

  // Check if customers already exist; if not, seed with the college project team
  const customerCount = (db.prepare('SELECT COUNT(*) as count FROM Customer').get() as { count: number }).count;
  if (customerCount === 0) {
    const insertCustomer = db.prepare('INSERT INTO Customer (name, email, phone, address, city) VALUES (?, ?, ?, ?, ?)');
    insertCustomer.run('Manepalli Abhishek', '25B11CS561@college.edu', '25B11CS561', 'Dept of CSE, Block A', 'Visakhapatnam');
    insertCustomer.run('Guru kiran Gowda', '25B11CS329@college.edu', '25B11CS329', 'Dept of CSE, Block B', 'Bengaluru');
    insertCustomer.run('Upparapalli Devi Sri', '25B11CS971@college.edu', '25B11CS971', 'Dept of CSE, Block A', 'Tirupati');
    insertCustomer.run('Kandipilli Hema Sankara VaraPrasad', '25B11CS395@college.edu', '25B11CS395', 'Dept of CSE, Block C', 'Kakinada');

    const insertCategory = db.prepare('INSERT INTO Category (category_name, description) VALUES (?, ?)');
    insertCategory.run('Electronics', 'Smartphones, audio, and personal computers');
    insertCategory.run('Footwear & Fashion', 'Apparel, sneakers, formal wear and accessories');
    insertCategory.run('Home & Kitchen', 'Appliances, cookware, and smart decor');
    insertCategory.run('Fitness & Sports', 'Workout equipment, yoga gear, and athletic shoes');
    insertCategory.run('Books & Stationery', 'Academic textbooks, fiction, and premium journals');

    const insertProduct = db.prepare('INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES (?, ?, ?, ?)');
    insertProduct.run('Noise-Cancelling Wireless Headphones', 4999.00, 42, 1);
    insertProduct.run('4K Smart LED Display 55-inch', 34999.00, 18, 1);
    insertProduct.run('Ergonomic Office Chair', 8499.00, 85, 3);
    insertProduct.run('Stainless Steel Chef Pan Set', 2999.00, 120, 3);
    insertProduct.run('Running Breathable Sneakers', 2499.00, 36, 2);
    insertProduct.run('Mechanical Gaming Keyboard', 3299.00, 64, 1);
    insertProduct.run('Smart Fitness Band Pro', 1899.00, 110, 4);
    insertProduct.run('Premium Leather Bifold Wallet', 999.00, 140, 2);
    insertProduct.run('Hardcover Leather Daily Planner', 499.00, 210, 5);
    insertProduct.run('Resistance Exercise Bands Set', 799.00, 95, 4);

    const now = new Date();
    const dMinus6 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const dMinus4 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const dMinus2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const dNow = now.toISOString();

    const insertOrder = db.prepare('INSERT INTO Orders (customer_id, order_date, status) VALUES (?, ?, ?)');
    insertOrder.run(1, dMinus6, 'Delivered');
    insertOrder.run(2, dMinus4, 'Shipped');
    insertOrder.run(3, dMinus2, 'Placed');
    insertOrder.run(4, dNow, 'Placed');

    const insertItem = db.prepare('INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
    insertItem.run(1, 1, 2, 4999.00);
    insertItem.run(1, 8, 1, 999.00);
    insertItem.run(2, 2, 1, 34999.00);
    insertItem.run(3, 3, 1, 8499.00);
    insertItem.run(3, 7, 2, 1899.00);
    insertItem.run(4, 5, 2, 2499.00);

    const insertPayment = db.prepare('INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (?, ?, ?, ?, ?)');
    insertPayment.run(1, 'UPI', dMinus6, 10997.00, 'Paid');
    insertPayment.run(2, 'Credit Card', dMinus4, 34999.00, 'Paid');
    insertPayment.run(3, 'UPI', null, 12297.00, 'Pending');
    insertPayment.run(4, 'COD', null, 4998.00, 'Pending');
  }
}

ensureDatabaseSchema();

// Helper to translate database errors to Oracle friendly messages
function translateDbError(err: any): { error: string; status: number } {
  const msg = String(err?.message || err);
  if (msg.includes('UNIQUE constraint failed')) {
    return {
      error: 'ORA-00001: unique constraint (CUSTOMER_EMAIL_UK) violated: A record with this unique value already exists.',
      status: 400,
    };
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return {
      error: 'ORA-02292: integrity constraint (ORDERS_CUSTOMER_FK) violated - child record found: Cannot delete record with active dependencies.',
      status: 400,
    };
  }
  if (msg.includes('CHECK constraint failed')) {
    return {
      error: 'ORA-02290: check constraint violated: Provided value fails database constraint validation (e.g. price > 0 or stock >= 0).',
      status: 400,
    };
  }
  return {
    error: `Database error: ${msg}`,
    status: 500,
  };
}

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

// GET /api/stats
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM Customer').get() as any).c;
    const totalProducts = (db.prepare('SELECT COUNT(*) as c FROM Product').get() as any).c;
    const totalOrders = (db.prepare('SELECT COUNT(*) as c FROM Orders').get() as any).c;
    const totalRevenue = (db.prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) as rev FROM Order_Item').get() as any).rev;
    const pendingPayments = (db.prepare("SELECT COUNT(*) as c FROM Payment WHERE payment_status = 'Pending'").get() as any).c;

    res.json({
      total_customers: totalCustomers,
      total_products: totalProducts,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      pending_payments: pendingPayments,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// GET /api/charts/revenue-by-category
app.get('/api/charts/revenue-by-category', (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        c.category_name, 
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
      FROM Category c
      LEFT JOIN Product p ON c.category_id = p.category_id
      LEFT JOIN Order_Item oi ON p.product_id = oi.product_id
      GROUP BY c.category_id, c.category_name
      ORDER BY revenue DESC
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// GET /api/charts/top-products
app.get('/api/charts/top-products', (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        p.product_name, 
        COALESCE(SUM(oi.quantity), 0) AS total_sold
      FROM Product p
      JOIN Order_Item oi ON p.product_id = oi.product_id
      GROUP BY p.product_id, p.product_name
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// GET /api/charts/orders-by-status
app.get('/api/charts/orders-by-status', (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT status, COUNT(*) AS count
      FROM Orders
      GROUP BY status
      ORDER BY count DESC
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// GET /api/charts/customer-spending
app.get('/api/charts/customer-spending', (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        c.name, 
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_spent
      FROM Customer c
      JOIN Orders o ON c.customer_id = o.customer_id
      JOIN Order_Item oi ON o.order_id = oi.order_id
      GROUP BY c.customer_id, c.name
      ORDER BY total_spent DESC
      LIMIT 5
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// ============================================================================
// CUSTOMERS CRUD
// ============================================================================

app.get('/api/customers', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT customer_id, name, email, phone, address, city FROM Customer ORDER BY customer_id ASC').all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.post('/api/customers', (req: Request, res: Response) => {
  const { name, email, phone, address, city } = req.body;

  if (!name || !email || !city) {
    return res.status(400).json({ error: 'Name, email, and city are mandatory fields.' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO Customer (name, email, phone, address, city)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = insert.run(name.trim(), email.trim(), (phone || '').trim(), (address || '').trim(), city.trim());
    const newId = Number(info.lastInsertRowid);

    res.status(201).json({
      message: 'Customer created successfully.',
      customer_id: newId,
      name,
      email,
      phone,
      address,
      city,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  const customerId = parseInt(req.params.id, 10);
  const { name, email, phone, address, city } = req.body;

  try {
    const update = db.prepare(`
      UPDATE Customer
      SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city)
      WHERE customer_id = ?
    `);
    const info = update.run(name ?? null, email ?? null, phone ?? null, address ?? null, city ?? null, customerId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const updated = db.prepare('SELECT * FROM Customer WHERE customer_id = ?').get(customerId);
    res.json(updated);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.delete('/api/customers/:id', (req: Request, res: Response) => {
  const customerId = parseInt(req.params.id, 10);

  // Check child records in Orders (foreign key check)
  const hasOrders = (db.prepare('SELECT COUNT(*) as c FROM Orders WHERE customer_id = ?').get(customerId) as any).c > 0;
  if (hasOrders) {
    return res.status(400).json({
      error: 'ORA-02292: integrity constraint (ORDERS_CUSTOMER_FK) violated - child record found: Cannot delete customer with active order history.',
    });
  }

  try {
    const info = db.prepare('DELETE FROM Customer WHERE customer_id = ?').run(customerId);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// ============================================================================
// CATEGORIES
// ============================================================================

app.get('/api/categories', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT category_id, category_name, description FROM Category ORDER BY category_id ASC').all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.post('/api/categories', (req: Request, res: Response) => {
  const { category_name, description } = req.body;
  if (!category_name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const insert = db.prepare('INSERT INTO Category (category_name, description) VALUES (?, ?)');
    const info = insert.run(category_name.trim(), (description || '').trim());
    res.status(201).json({
      category_id: Number(info.lastInsertRowid),
      category_name,
      description,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// ============================================================================
// PRODUCTS CRUD
// ============================================================================

app.get('/api/products', (req: Request, res: Response) => {
  const { search, category_id } = req.query;

  try {
    let sql = `
      SELECT 
        p.product_id, 
        p.product_name, 
        p.price, 
        p.stock_qty, 
        p.category_id, 
        c.category_name
      FROM Product p
      JOIN Category c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }

    if (search) {
      sql += ' AND (LOWER(p.product_name) LIKE ? OR LOWER(c.category_name) LIKE ?)';
      const term = `%${String(search).toLowerCase()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY p.product_id ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.post('/api/products', (req: Request, res: Response) => {
  const { product_name, category_id, price, stock_qty } = req.body;

  if (!product_name || price === undefined || stock_qty === undefined) {
    return res.status(400).json({ error: 'product_name, price, and stock_qty are required.' });
  }

  if (Number(price) <= 0) {
    return res.status(400).json({ error: 'ORA-02290: check constraint violated: price must be greater than 0.' });
  }

  if (Number(stock_qty) < 0) {
    return res.status(400).json({ error: 'ORA-02290: check constraint violated: stock_qty cannot be negative.' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO Product (product_name, price, stock_qty, category_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = insert.run(product_name.trim(), Number(price), Number(stock_qty), Number(category_id) || 1);
    res.status(201).json({
      product_id: Number(info.lastInsertRowid),
      product_name,
      price: Number(price),
      stock_qty: Number(stock_qty),
      category_id: Number(category_id) || 1,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const productId = parseInt(req.params.id, 10);
  const { product_name, category_id, price, stock_qty } = req.body;

  if (price !== undefined && Number(price) <= 0) {
    return res.status(400).json({ error: 'ORA-02290: check constraint violated: price must be > 0.' });
  }

  if (stock_qty !== undefined && Number(stock_qty) < 0) {
    return res.status(400).json({ error: 'ORA-02290: check constraint violated: stock_qty cannot be negative.' });
  }

  try {
    const update = db.prepare(`
      UPDATE Product
      SET 
        product_name = COALESCE(?, product_name),
        category_id = COALESCE(?, category_id),
        price = COALESCE(?, price),
        stock_qty = COALESCE(?, stock_qty)
      WHERE product_id = ?
    `);
    const info = update.run(
      product_name ?? null,
      category_id !== undefined ? Number(category_id) : null,
      price !== undefined ? Number(price) : null,
      stock_qty !== undefined ? Number(stock_qty) : null,
      productId
    );

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const updated = db.prepare('SELECT * FROM Product WHERE product_id = ?').get(productId);
    res.json(updated);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  const productId = parseInt(req.params.id, 10);

  const hasOrders = (db.prepare('SELECT COUNT(*) as c FROM Order_Item WHERE product_id = ?').get(productId) as any).c > 0;
  if (hasOrders) {
    return res.status(400).json({
      error: 'ORA-02292: integrity constraint violated - child record found: Product has existing order lines.',
    });
  }

  try {
    const info = db.prepare('DELETE FROM Product WHERE product_id = ?').run(productId);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// ============================================================================
// ORDERS & ACID TRANSACTION (REAL SQL TRANSACTIONS)
// ============================================================================

// GET /api/orders (View order_summary)
app.get('/api/orders', (req: Request, res: Response) => {
  const { status, customer_id } = req.query;

  try {
    let sql = `
      SELECT 
        o.order_id, 
        o.customer_id,
        c.name AS customer, 
        o.order_date, 
        o.status, 
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS order_total, 
        COALESCE(p.payment_status, 'Pending') AS payment_status,
        p.payment_method
      FROM Orders o
      JOIN Customer c ON o.customer_id = c.customer_id
      LEFT JOIN Order_Item oi ON o.order_id = oi.order_id
      LEFT JOIN Payment p ON o.order_id = p.order_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (customer_id) {
      sql += ' AND o.customer_id = ?';
      params.push(Number(customer_id));
    }

    if (status) {
      sql += ' AND LOWER(o.status) = LOWER(?)';
      params.push(String(status));
    }

    sql += ' GROUP BY o.order_id, o.customer_id, c.name, o.order_date, o.status, p.payment_status, p.payment_method ORDER BY o.order_id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', (req: Request, res: Response) => {
  const orderId = parseInt(req.params.id, 10);

  try {
    const orderSql = `
      SELECT 
        o.order_id, 
        o.customer_id, 
        c.name AS customer_name, 
        c.email AS customer_email,
        o.order_date, 
        o.status
      FROM Orders o
      JOIN Customer c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?
    `;
    const order = db.prepare(orderSql).get(orderId) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const itemsSql = `
      SELECT 
        oi.product_id, 
        p.product_name, 
        oi.quantity, 
        oi.unit_price, 
        (oi.quantity * oi.unit_price) AS line_total
      FROM Order_Item oi
      JOIN Product p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.product_id ASC
    `;
    const items = db.prepare(itemsSql).all(orderId);

    const paymentSql = `
      SELECT 
        payment_id, 
        order_id, 
        payment_method, 
        payment_date, 
        amount, 
        payment_status
      FROM Payment
      WHERE order_id = ?
    `;
    const payment = db.prepare(paymentSql).get(orderId) || null;

    const total = items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
    order.order_total = total;

    res.json({
      order,
      items,
      payment,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// PUT /api/orders/:id/status
app.put('/api/orders/:id/status', (req: Request, res: Response) => {
  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;

  const validStatuses = ['Placed', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const info = db.prepare('UPDATE Orders SET status = ? WHERE order_id = ?').run(status, orderId);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ message: 'Order status updated successfully.', order_id: orderId, status });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

/**
 * POST /api/orders
 * Demonstrates Real ACID Transactions in the SQL database:
 * 1. Checks Customer exists
 * 2. Checks inventory stock for each product
 * 3. Atomic INSERT Orders, Order_Item, and Product stock decrement
 * 4. INSERT Payment
 * 5. COMMIT on success, ROLLBACK on any failure
 */
app.post('/api/orders', (req: Request, res: Response) => {
  const { customer_id, payment_method, items } = req.body;

  if (!customer_id || !payment_method || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customer_id, payment_method, and items array are required.' });
  }

  // BEGIN ACID TRANSACTION
  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Verify Customer
    const customer = db.prepare('SELECT customer_id FROM Customer WHERE customer_id = ?').get(customer_id);
    if (!customer) {
      db.exec('ROLLBACK;');
      return res.status(400).json({
        error: 'ORA-02291: integrity constraint (ORDERS_CUSTOMER_FK) violated - parent key not found: Invalid customer_id.',
      });
    }

    // 2. Verify Stock for all items
    let orderTotal = 0;
    const verifiedItems: Array<{ product_id: number; product_name: string; price: number; quantity: number }> = [];

    for (const item of items) {
      const pid = Number(item.product_id);
      const qty = Number(item.quantity);

      if (!pid || isNaN(qty) || qty <= 0) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: 'Each item must have a valid product_id and quantity > 0.' });
      }

      const prod = db.prepare('SELECT product_name, price, stock_qty FROM Product WHERE product_id = ?').get(pid) as any;
      if (!prod) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: `ORA-02291: Product #${pid} does not exist.` });
      }

      if (prod.stock_qty < qty) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          error: `Insufficient stock for product "${prod.product_name}". Requested: ${qty}, Available: ${prod.stock_qty}.`,
        });
      }

      orderTotal += (prod.price * qty);
      verifiedItems.push({
        product_id: pid,
        product_name: prod.product_name,
        price: prod.price,
        quantity: qty,
      });
    }

    // 3. Insert Order
    const orderDate = new Date().toISOString();
    const orderInfo = db.prepare('INSERT INTO Orders (customer_id, order_date, status) VALUES (?, ?, ?)').run(
      customer_id,
      orderDate,
      'Placed'
    );
    const newOrderId = Number(orderInfo.lastInsertRowid);

    // 4. Insert Order Items & Decrement Stock
    const insertItemStmt = db.prepare('INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
    const updateStockStmt = db.prepare('UPDATE Product SET stock_qty = stock_qty - ? WHERE product_id = ?');

    for (const v of verifiedItems) {
      insertItemStmt.run(newOrderId, v.product_id, v.quantity, v.price);
      updateStockStmt.run(v.quantity, v.product_id);
    }

    // 5. Insert Payment Record
    const insertPaymentStmt = db.prepare(`
      INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertPaymentStmt.run(newOrderId, payment_method, null, orderTotal, 'Pending');

    // COMMIT ACID TRANSACTION
    db.exec('COMMIT;');

    res.status(201).json({
      message: 'Order created successfully under ACID transaction.',
      order_id: newOrderId,
      total: orderTotal,
      order_total: orderTotal,
      status: 'Placed',
    });
  } catch (txErr) {
    db.exec('ROLLBACK;');
    const tr = translateDbError(txErr);
    res.status(tr.status).json({ error: tr.error });
  }
});

// ============================================================================
// PAYMENTS
// ============================================================================

app.get('/api/payments', (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        p.payment_id, 
        p.order_id, 
        c.name AS customer_name, 
        p.payment_method, 
        p.payment_date, 
        p.amount, 
        p.payment_status
      FROM Payment p
      JOIN Orders o ON p.order_id = o.order_id
      JOIN Customer c ON o.customer_id = c.customer_id
      ORDER BY p.payment_id DESC
    `;
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

app.put('/api/payments/:order_id', (req: Request, res: Response) => {
  const orderId = parseInt(req.params.order_id, 10);
  const payDate = new Date().toISOString();

  try {
    const info = db.prepare(`
      UPDATE Payment 
      SET payment_status = 'Paid', payment_date = ? 
      WHERE order_id = ?
    `).run(payDate, orderId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Payment record for order not found.' });
    }

    const updated = db.prepare('SELECT * FROM Payment WHERE order_id = ?').get(orderId);
    res.json({
      message: `Payment for Order #${orderId} marked as Paid.`,
      payment: updated,
    });
  } catch (err) {
    const tr = translateDbError(err);
    res.status(tr.status).json({ error: tr.error });
  }
});

// Fallback to index.html for SPA
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Online Shopping System Server connected to shopping_system.db on port ${PORT}`);
});
