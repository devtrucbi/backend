const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { Server } = require('socket.io');
const http = require('http');
const userRoutes = require('./routes/users');
const customerRoutes = require('./routes/customers');
const taskRoutes = require('./routes/tasks');
const dealRoutes = require('./routes/deals');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/advanced-analytics');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://frontend-f3fbtwpwx-dang-khois-projects.vercel.app',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: 'https://frontend-f3fbtwpwx-dang-khois-projects.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(helmet());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  connectTimeout: 30000
};

const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const pool = await mysql.createPool(dbConfig);
      console.log('MySQL Connected');
      return pool;
    } catch (err) {
      console.error(`MySQL Connection Error (Attempt ${i + 1}/${retries}):`, err.message);
      console.error('Error Code:', err.code);
      console.error('Error Details:', err);
      if (i === retries - 1) throw err;
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const startServer = async () => {
  try {
    const pool = await connectWithRetry();
    app.use('/api/users', userRoutes(pool, io));
    app.use('/api/customers', customerRoutes(pool, io));
    app.use('/api/tasks', taskRoutes(pool, io));
    app.use('/api/deals', dealRoutes(pool, io));
    app.use('/api/reports', reportRoutes(pool, io));
    app.use('/api/notifications', notificationRoutes(pool, io));
    app.use('/api/advanced-analytics', analyticsRoutes(pool, io));

    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);
      socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
      });
    });

    server.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();