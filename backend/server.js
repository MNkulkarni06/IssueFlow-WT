require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const createApp = require('./app');
const connectDB = require('./config/db');
const { setIO } = require('./utils/socket');
const { startEscalationJob } = require('./jobs/escalationJob');
const { startSlaWarningJob } = require('./jobs/slaWarningJob');
const { startNotificationCleanupJob } = require('./jobs/notificationCleanupJob');

async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
  });

  // Authenticate socket connections via the same JWT used for the REST API,
  // then join a private per-user room so notifications never leak across
  // users or organizations.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.on('disconnect', () => {});
  });

  setIO(io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`[server] IssueFlow backend running on port ${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  const schedule = process.env.CRON_SCHEDULE || '*/1 * * * *';
  startEscalationJob(schedule);
  startSlaWarningJob(schedule);
  startNotificationCleanupJob();
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
