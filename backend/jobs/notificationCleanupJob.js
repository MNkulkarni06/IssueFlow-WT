const cron = require('node-cron');
const { Notification } = require('../models');

// Removes read notifications older than 30 days. Runs once a day regardless
// of the (often very short) dev CRON_SCHEDULE used for escalation testing.
function startNotificationCleanupJob() {
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await Notification.deleteMany({ read: true, createdAt: { $lt: cutoff } });
      if (result.deletedCount) {
        console.log(`[notificationCleanupJob] removed ${result.deletedCount} old notifications`);
      }
    } catch (err) {
      console.error('[notificationCleanupJob] error:', err);
    }
  });
  console.log('[notificationCleanupJob] scheduled daily at 03:00');
}

module.exports = { startNotificationCleanupJob };
