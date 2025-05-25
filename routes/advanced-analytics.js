const router = require('express').Router();

module.exports = (pool, io) => {
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
      // Kiểm tra vai trò người dùng
      if (req.userRole !== 'premium') {
        return res.status(403).json({ error: 'Only premium users can access advanced analytics' });
      }

      // Lấy tổng số khách hàng
      const [customerCount] = await pool.query(
        'SELECT COUNT(*) AS total_customers FROM customers WHERE user_id = ?',
        [req.userId]
      );

      // Lấy tổng số công việc hoàn thành
      const [completedTasks] = await pool.query(
        'SELECT COUNT(*) AS completed_tasks FROM tasks WHERE user_id = ? AND status = ?',
        [req.userId, 'completed']
      );

      // Lấy tổng số giao dịch đóng
      const [closedDeals] = await pool.query(
        'SELECT COUNT(*) AS closed_deals, SUM(amount) AS total_amount FROM deals WHERE user_id = ? AND stage = ?',
        [req.userId, 'closed']
      );

      const analytics = {
        total_customers: customerCount[0].total_customers,
        completed_tasks: completedTasks[0].completed_tasks,
        closed_deals: closedDeals[0].closed_deals,
        total_deal_amount: closedDeals[0].total_amount || 0
      };

      res.json(analytics);
    } catch (err) {
      console.log('Analytics Fetch Error:', err);
      res.status(400).json({ error: 'Failed to fetch analytics', details: err.message });
    }
  });

  return router;
};