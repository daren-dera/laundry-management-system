require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'laundry_management',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'laundry.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Please log in to continue.' });
  next();
};
const validId = value => Number.isInteger(Number(value)) && Number(value) > 0;
const cleanText = (v, max = 255) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const money = n => Number(n);
const sendDbError = (res, error) => {
  console.error(error);
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ message: 'This record is connected to another record and cannot be removed yet.' });
  }
  res.status(500).json({ message: 'A server or database error occurred.' });
};

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = cleanText(req.body.username, 80);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
  const [rows] = await pool.execute('SELECT id, username, password_hash, full_name, role FROM users WHERE username = ?', [username]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ message: 'Could not start a secure session.' });
    req.session.user = { id: rows[0].id, username: rows[0].username, fullName: rows[0].full_name, role: rows[0].role };
    res.json({ user: req.session.user });
  });
}));
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Could not log out.' });
    res.clearCookie('laundry.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

// Services CRUD
app.get('/api/services', requireAuth, asyncRoute(async (req, res) => {
  const q = `%${cleanText(req.query.q, 100)}%`;
  const [rows] = await pool.execute(
    'SELECT * FROM services WHERE name LIKE ? OR description LIKE ? ORDER BY id DESC', [q, q]
  );
  res.json(rows);
}));
app.post('/api/services', requireAuth, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 120), description = cleanText(req.body.description, 255);
  const price = Number(req.body.price), hours = Number(req.body.turnaround_hours || 24);
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(hours) || hours < 1 || hours > 720)
    return res.status(400).json({ message: 'Enter a service name, non-negative price and turnaround of 1–720 hours.' });
  const [result] = await pool.execute('INSERT INTO services (name, description, price, turnaround_hours, active) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, hours, req.body.active === false || req.body.active === 0 ? 0 : 1]);
  res.status(201).json({ id: result.insertId, name, description, price, turnaround_hours: hours, active: 1 });
}));
app.put('/api/services/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid service ID.' });
  const name = cleanText(req.body.name, 120), description = cleanText(req.body.description, 255);
  const price = Number(req.body.price), hours = Number(req.body.turnaround_hours || 24);
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(hours) || hours < 1 || hours > 720)
    return res.status(400).json({ message: 'Please check the service fields.' });
  const [r] = await pool.execute('UPDATE services SET name=?, description=?, price=?, turnaround_hours=?, active=? WHERE id=?',
    [name, description, price, hours, req.body.active === false || req.body.active === 0 ? 0 : 1, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Service not found.' });
  res.json({ message: 'Service updated.' });
}));
app.delete('/api/services/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid service ID.' });
  const [r] = await pool.execute('DELETE FROM services WHERE id=?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Service not found.' });
  res.json({ message: 'Service deleted.' });
}));

// Customers CRUD
app.get('/api/customers', requireAuth, asyncRoute(async (req, res) => {
  const q = `%${cleanText(req.query.q, 100)}%`;
  const [rows] = await pool.execute(
    'SELECT * FROM customers WHERE full_name LIKE ? OR phone LIKE ? OR COALESCE(email, "") LIKE ? ORDER BY id DESC', [q, q, q]
  );
  res.json(rows);
}));
app.post('/api/customers', requireAuth, asyncRoute(async (req, res) => {
  const fullName = cleanText(req.body.full_name, 120), phone = cleanText(req.body.phone, 30);
  const email = cleanText(req.body.email, 150), address = cleanText(req.body.address, 255);
  if (fullName.length < 2 || phone.length < 5) return res.status(400).json({ message: 'Enter a customer name and valid phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  const [r] = await pool.execute('INSERT INTO customers (full_name, phone, email, address) VALUES (?, ?, ?, ?)',
    [fullName, phone, email || null, address]);
  res.status(201).json({ id: r.insertId, full_name: fullName, phone, email, address });
}));
app.put('/api/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID.' });
  const fullName = cleanText(req.body.full_name, 120), phone = cleanText(req.body.phone, 30);
  const email = cleanText(req.body.email, 150), address = cleanText(req.body.address, 255);
  if (fullName.length < 2 || phone.length < 5) return res.status(400).json({ message: 'Enter a customer name and valid phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  const [r] = await pool.execute('UPDATE customers SET full_name=?, phone=?, email=?, address=? WHERE id=?',
    [fullName, phone, email || null, address, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Customer not found.' });
  res.json({ message: 'Customer updated.' });
}));
app.delete('/api/customers/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID.' });
  const [r] = await pool.execute('DELETE FROM customers WHERE id=?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Customer not found.' });
  res.json({ message: 'Customer deleted.' });
}));

// Orders and order status
app.get('/api/orders', requireAuth, asyncRoute(async (req, res) => {
  const q = `%${cleanText(req.query.q, 100)}%`;
  const status = cleanText(req.query.status, 30);
  const params = [q, q, q];
  let sql = `SELECT o.*, c.full_name AS customer_name, c.phone, s.name AS service_name,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id AND p.status='Paid'),0) AS paid_amount
    FROM orders o JOIN customers c ON c.id=o.customer_id JOIN services s ON s.id=o.service_id
    WHERE (CAST(o.id AS CHAR) LIKE ? OR c.full_name LIKE ? OR s.name LIKE ?)`;
  if (['Pending','Washing','Ready','Delivered','Cancelled'].includes(status)) { sql += ' AND o.status=?'; params.push(status); }
  sql += ' ORDER BY o.id DESC';
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
}));
app.post('/api/orders', requireAuth, asyncRoute(async (req, res) => {
  const customerId = Number(req.body.customer_id), serviceId = Number(req.body.service_id), quantity = Number(req.body.quantity);
  const notes = cleanText(req.body.notes, 500);
  if (!validId(customerId) || !validId(serviceId) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)
    return res.status(400).json({ message: 'Choose a customer and service, and enter a quantity greater than zero.' });
  const [services] = await pool.execute('SELECT price, turnaround_hours, active FROM services WHERE id=?', [serviceId]);
  if (!services.length || !services[0].active) return res.status(400).json({ message: 'Choose an active service.' });
  const [customers] = await pool.execute('SELECT id FROM customers WHERE id=?', [customerId]);
  if (!customers.length) return res.status(400).json({ message: 'Customer not found.' });
  const total = Number((services[0].price * quantity).toFixed(2));
  const [r] = await pool.execute(
    `INSERT INTO orders (customer_id, service_id, quantity, total_amount, notes, due_date)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [customerId, serviceId, quantity, total, notes, services[0].turnaround_hours]
  );
  res.status(201).json({ id: r.insertId, total_amount: total, status: 'Pending' });
}));
app.put('/api/orders/:id/status', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  const allowed = ['Pending','Washing','Ready','Delivered','Cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid order status.' });
  const [r] = await pool.execute('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Order not found.' });
  res.json({ message: 'Order status updated.' });
}));
app.delete('/api/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
  const [payments] = await pool.execute('SELECT id FROM payments WHERE order_id=?', [req.params.id]);
  if (payments.length) return res.status(409).json({ message: 'This order has payment records and cannot be deleted.' });
  const [r] = await pool.execute('DELETE FROM orders WHERE id=?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Order not found.' });
  res.json({ message: 'Order deleted.' });
}));

// Mock payment: records a simulated payment; never contacts a payment provider.
app.get('/api/payments', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT p.*, o.total_amount, c.full_name AS customer_name
    FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id ORDER BY p.id DESC`);
  res.json(rows);
}));
app.post('/api/payments', requireAuth, asyncRoute(async (req, res) => {
  const orderId = Number(req.body.order_id), amount = Number(req.body.amount);
  const method = cleanText(req.body.method, 40);
  if (!validId(orderId) || !Number.isFinite(amount) || amount <= 0 ||
      !['Cash','Card (Mock)','Bank Transfer (Mock)'].includes(method))
    return res.status(400).json({ message: 'Select an order, valid amount and payment method.' });
  const [orders] = await pool.execute('SELECT total_amount FROM orders WHERE id=? AND status <> "Cancelled"', [orderId]);
  if (!orders.length) return res.status(404).json({ message: 'Active order not found.' });
  const [paidRows] = await pool.execute("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id=? AND status='Paid'", [orderId]);
  const due = Number((orders[0].total_amount - paidRows[0].paid).toFixed(2));
  if (amount > due + 0.001) return res.status(400).json({ message: `Amount exceeds the outstanding balance (${due.toFixed(2)}).` });
  const ref = 'MOCK-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const [r] = await pool.execute("INSERT INTO payments (order_id, amount, method, status, reference_code) VALUES (?, ?, ?, 'Paid', ?)",
    [orderId, amount, method, ref]);
  res.status(201).json({ id: r.insertId, reference_code: ref, message: 'Mock payment recorded. No real money was charged.' });
}));
app.get('/api/reports/summary', requireAuth, asyncRoute(async (req, res) => {
  const [[customers]] = await pool.query('SELECT COUNT(*) AS total FROM customers');
  const [[services]] = await pool.query('SELECT COUNT(*) AS total FROM services WHERE active=1');
  const [[orders]] = await pool.query('SELECT COUNT(*) AS total FROM orders');
  const [[pending]] = await pool.query("SELECT COUNT(*) AS total FROM orders WHERE status IN ('Pending','Washing','Ready')");
  const [[sales]] = await pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status='Paid'");
  const [[unpaid]] = await pool.query(`SELECT COALESCE(SUM(o.total_amount - COALESCE(p.paid,0)),0) AS total FROM orders o
    LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM payments WHERE status='Paid' GROUP BY order_id) p ON p.order_id=o.id
    WHERE o.status <> 'Cancelled'`);
  const [recent] = await pool.query(`SELECT o.id, c.full_name AS customer_name, s.name AS service_name, o.total_amount, o.status, o.order_date
    FROM orders o JOIN customers c ON c.id=o.customer_id JOIN services s ON s.id=o.service_id ORDER BY o.id DESC LIMIT 7`);
  const [monthly] = await pool.query(`SELECT DATE_FORMAT(paid_at,'%Y-%m') AS month, SUM(amount) AS revenue
    FROM payments WHERE status='Paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(paid_at,'%Y-%m') ORDER BY month`);
  res.json({ customers: customers.total, activeServices: services.total, orders: orders.total, activeOrders: pending,
    revenue: Number(sales.total), outstanding: Number(unpaid.total), recent, monthly });
}));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  sendDbError(res, err);
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connection pool ready.');
  } catch (err) {
    console.error('Could not connect to MySQL. Check .env and import database/schema.sql.', err.message);
  }
  app.listen(PORT, () => console.log(`Laundry Management System running at http://localhost:${PORT}`));
})();
