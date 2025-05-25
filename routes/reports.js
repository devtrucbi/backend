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
        ? 'SELECT * FROM reports'
        : 'SELECT * FROM reports WHERE user_id = ?';
      const params = req.userRole === 'admin' ? [] : [req.userId];
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/', authenticate, async (req, res) => {
    try {
      const { title, data } = req.body;
      const query = 'INSERT INTO reports (user_id, title, data) VALUES (?, ?, ?)';
      const params = [req.userId, title, JSON.stringify(data)];
      await pool.query(query, params);
      res.status(201).json({ message: 'Report added' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};