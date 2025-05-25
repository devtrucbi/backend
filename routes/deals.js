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
        ? 'SELECT * FROM deals'
        : 'SELECT * FROM deals WHERE user_id = ?';
      const params = req.userRole === 'admin' ? [] : [req.userId];
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/', authenticate, async (req, res) => {
    try {
      const { customer_id, title, amount, stage } = req.body;
      const query = 'INSERT INTO deals (user_id, customer_id, title, amount, stage) VALUES (?, ?, ?, ?, ?)';
      const params = [req.userId, customer_id, title, amount, stage];
      await pool.query(query, params);
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [req.userId, `New deal ${title} created`]
      );
      io.emit('newNotification', { userId: req.userId, message: `New deal ${title} created` });
      res.status(201).json({ message: 'Deal added' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_id, title, amount, stage } = req.body;
      const query = req.userRole === 'admin'
        ? 'UPDATE deals SET customer_id = ?, title = ?, amount = ?, stage = ? WHERE id = ?'
        : 'UPDATE deals SET customer_id = ?, title = ?, amount = ?, stage = ? WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin'
        ? [customer_id, title, amount, stage, id]
        : [customer_id, title, amount, stage, id, req.userId];
      await pool.query(query, params);
      res.json({ message: 'Deal updated' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const query = req.userRole === 'admin'
        ? 'DELETE FROM deals WHERE id = ?'
        : 'DELETE FROM deals WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin' ? [id] : [id, req.userId];
      await pool.query(query, params);
      res.json({ message: 'Deal deleted' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};