const jwt = require('jsonwebtoken');

module.exports = (pool, io) => {
  const router = require('express').Router();

  const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;
      req.userRole = decoded.role;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  router.get('/', authenticate, async (req, res) => {
    try {
      const query = req.userRole === 'admin'
        ? 'SELECT * FROM customers'
        : 'SELECT * FROM customers WHERE user_id = ?';
      const params = req.userRole === 'admin' ? [] : [req.userId];
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phone, address, interactions } = req.body;
    const validInteractions = Array.isArray(interactions) ? interactions : []; // Đặt giá trị mặc định là []
    const query = 'INSERT INTO customers (user_id, name, email, phone, address, interactions) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [req.userId, name, email, phone, address, JSON.stringify(validInteractions)];
    await pool.query(query, params);
    await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [req.userId, `New customer ${name} added`]
    );
    io.emit('newNotification', { userId: req.userId, message: `New customer ${name} added` });
    res.status(201).json({ message: 'Customer added' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, interactions } = req.body;
    const validInteractions = Array.isArray(interactions) ? interactions : []; // Đặt giá trị mặc định là []
    const query = req.userRole === 'admin'
      ? 'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, interactions = ? WHERE id = ?'
      : 'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, interactions = ? WHERE id = ? AND user_id = ?';
    const params = req.userRole === 'admin'
      ? [name, email, phone, address, JSON.stringify(validInteractions), id]
      : [name, email, phone, address, JSON.stringify(validInteractions), id, req.userId];
    await pool.query(query, params);
    io.emit('newNotification', { userId: req.userId, message: `Customer ${name} updated` });
    res.json({ message: 'Customer updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, address, interactions } = req.body;
      const validInteractions = Array.isArray(interactions) ? interactions : [];
      const query = req.userRole === 'admin'
        ? 'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, interactions = ? WHERE id = ?'
        : 'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, interactions = ? WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin'
        ? [name, email, phone, address, JSON.stringify(validInteractions), id]
        : [name, email, phone, address, JSON.stringify(validInteractions), id, req.userId];
      await pool.query(query, params);
      io.emit('newNotification', { userId: req.userId, message: `Customer ${name} updated` });
      res.json({ message: 'Customer updated' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const query = req.userRole === 'admin'
        ? 'DELETE FROM customers WHERE id = ?'
        : 'DELETE FROM customers WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin' ? [id] : [id, req.userId];
      await pool.query(query, params);
      io.emit('newNotification', { userId: req.userId, message: `Customer deleted` });
      res.json({ message: 'Customer deleted' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};