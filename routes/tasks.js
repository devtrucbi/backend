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
        ? 'SELECT * FROM tasks'
        : 'SELECT * FROM tasks WHERE user_id = ?';
      const params = req.userRole === 'admin' ? [] : [req.userId];
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/', authenticate, async (req, res) => {
    try {
      const { customer_id, title, description, status, due_date } = req.body;
      const query = 'INSERT INTO tasks (user_id, customer_id, title, description, status, due_date) VALUES (?, ?, ?, ?, ?, ?)';
      const params = [req.userId, customer_id, title, description, status, due_date];
      await pool.query(query, params);
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [req.userId, `New task ${title} created`]
      );
      io.emit('newNotification', { userId: req.userId, message: `New task ${title} created` });
      res.status(201).json({ message: 'Task added' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_id, title, description, status, due_date } = req.body;
      const query = req.userRole === 'admin'
        ? 'UPDATE tasks SET customer_id = ?, title = ?, description = ?, status = ?, due_date = ? WHERE id = ?'
        : 'UPDATE tasks SET customer_id = ?, title = ?, description = ?, status = ?, due_date = ? WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin'
        ? [customer_id, title, description, status, due_date, id]
        : [customer_id, title, description, status, due_date, id, req.userId];
      await pool.query(query, params);
      res.json({ message: 'Task updated' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const query = req.userRole === 'admin'
        ? 'DELETE FROM tasks WHERE id = ?'
        : 'DELETE FROM tasks WHERE id = ? AND user_id = ?';
      const params = req.userRole === 'admin' ? [id] : [id, req.userId];
      await pool.query(query, params);
      res.json({ message: 'Task deleted' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};