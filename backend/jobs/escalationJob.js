const cron = require('node-cron');
const { findExpiredComplaints, escalateComplaint } = require('../services/escalationService');

function startEscalationJob(schedule) {
  cron.schedule(schedule, async () => {
    try {
      const expired = await findExpiredComplaints();
      if (expired.length === 0) return;
      console.log(`[escalationJob] Found ${expired.length} expired complaint(s). Escalating...`);
      for (const c of expired) {
        // eslint-disable-next-line no-await-in-loop
        const result = await escalateComplaint(c._id, { performedBy: null, reason: 'SLA deadline passed (automatic)' });
        if (result.escalated) {
          console.log(`[escalationJob] Escalated complaint ${c._id}`);
        }
      }
    } catch (err) {
      console.error('[escalationJob] error:', err);
    }
  });
  console.log(`[escalationJob] scheduled with pattern "${schedule}"`);
}

module.exports = { startEscalationJob };
