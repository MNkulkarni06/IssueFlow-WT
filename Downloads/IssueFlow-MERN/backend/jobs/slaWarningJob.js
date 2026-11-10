const cron = require('node-cron');
const { Complaint, Organization } = require('../models');
const slaService = require('../services/slaService');
const notificationService = require('../services/notificationService');

function startSlaWarningJob(schedule) {
  cron.schedule(schedule, async () => {
    try {
      const activeComplaints = await Complaint.find({
        status: { $in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
        slaWarningSent: false,
        slaDeadline: { $gt: new Date() },
      });
      if (activeComplaints.length === 0) return;

      const orgCache = new Map();
      for (const complaint of activeComplaints) {
        const orgId = String(complaint.organizationId);
        if (!orgCache.has(orgId)) {
          // eslint-disable-next-line no-await-in-loop
          orgCache.set(orgId, await Organization.findById(orgId));
        }
        const org = orgCache.get(orgId);
        const settings = org ? org.settings : {};
        const approaching = slaService.isApproachingDeadline(
          complaint,
          settings.slaWarningPercent,
          settings.slaWarningMinutesRemaining,
          complaint.createdAt
        );
        if (!approaching) continue;

        // eslint-disable-next-line no-await-in-loop
        await Complaint.updateOne({ _id: complaint._id, slaWarningSent: false }, { $set: { slaWarningSent: true } });

        if (complaint.currentAssignee) {
          // eslint-disable-next-line no-await-in-loop
          await notificationService.notify({
            organizationId: complaint.organizationId,
            userId: complaint.currentAssignee,
            type: 'SLA_WARNING',
            title: 'SLA deadline approaching',
            message: `Complaint "${complaint.title}" is approaching its SLA deadline.`,
            complaintId: complaint._id,
          });
        }
      }
    } catch (err) {
      console.error('[slaWarningJob] error:', err);
    }
  });
  console.log(`[slaWarningJob] scheduled with pattern "${schedule}"`);
}

module.exports = { startSlaWarningJob };
