const jwt = require('jsonwebtoken');

module.exports = (pool, io) => {
  const router = require('express').Router();

  const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Received Token:', token);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded Token:', decoded);
      req.userId = decoded.id;
      req.userRole = decoded.role;
      next();
    } catch (err) {
      console.log('Token Verification Error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  router.get('/', authenticate, async (req, res) => {
    try {
      console.log('Fetching notifications for user:', req.userId);
      const [results] = await pool.query('SELECT * FROM notifications WHERE user_id = ?', [req.userId]);
      console.log('Notifications:', results);
      res.json(results);
    } catch (err) {
      console.log('Notification Fetch Error:', err);
      res.status(400).json({ error: 'Failed to fetch notifications', details: err.message });
    }
  });

  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Marking notification as read:', id, 'for user:', req.userId);
      const [result] = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, req.userId]);
      console.log('Update Result:', result);
      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      console.log('Notification Update Error:', err);
      res.status(400).json({ error: 'Failed to mark notification as read', details: err.message });
    }
  });

  return router;
};