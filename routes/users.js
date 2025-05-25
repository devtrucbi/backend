const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

module.exports = (pool, io) => {
  const router = require('express').Router();

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Middleware xác thực
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

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, role } = req.body;

      // Kiểm tra nếu tạo tài khoản admin thì người yêu cầu phải là admin
      const token = req.headers.authorization?.split(' ')[1];
      if (role === 'admin') {
        if (!token) {
          return res.status(403).json({ error: 'Chỉ admin mới có thể tạo tài khoản admin' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Chỉ admin mới có thể tạo tài khoản admin' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, role || 'user']
      );
      await transporter.sendMail({
        to: email,
        subject: 'Welcome to CRM SaaS',
        text: `Hi ${name}, your account has been created!`
      });
      res.status(201).json({ message: 'User registered' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const [results] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (results.length === 0) return res.status(400).json({ error: 'User not found' });
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/upgrade', async (req, res) => {
    const { userId, promoCode } = req.body;

    const validPromoCodes = ['PROMO2025', 'FREEPREMIUM'];
    if (!validPromoCodes.includes(promoCode)) {
      return res.status(400).json({ error: 'Mã khuyến mãi không hợp lệ' });
    }

    try {
      await pool.query('UPDATE users SET role = ? WHERE id = ?', ['premium', userId]);
      io.emit('newNotification', { userId, message: 'Tài khoản của bạn đã được nâng cấp lên Premium!' });
      res.json({ message: 'Tài khoản đã được nâng cấp lên Premium' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/me', authenticate, async (req, res) => {
    try {
      const [results] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
      if (results.length === 0) return res.status(400).json({ error: 'User not found' });
      const user = results[0];
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Route mới: Lấy danh sách người dùng (chỉ dành cho admin)
  router.get('/', authenticate, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có thể xem danh sách người dùng' });
    }

    try {
      const [results] = await pool.query('SELECT id, email, name, role FROM users');
      res.json(results);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Route mới: Cập nhật vai trò người dùng (chỉ dành cho admin)
  router.put('/:id/role', authenticate, async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có thể cập nhật vai trò người dùng' });
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'premium'].includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
    }

    try {
      await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
      io.emit('newNotification', { userId: id, message: `Vai trò của bạn đã được cập nhật thành ${role}` });
      res.json({ message: 'Vai trò đã được cập nhật' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};