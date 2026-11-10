const { Complaint, ComplaintCategory, ComplaintHistory } = require('../models');
const hierarchyService = require('./hierarchyService');
const slaService = require('./slaService');
const notificationService = require('./notificationService');
const { getOrgAdminUsers } = require('./organizationService');

// Escalates ONE complaint to the next configured hierarchy level.
// `performedBy` is null for automatic (cron) escalations.
// Uses an atomic findOneAndUpdate guarded by the complaint's CURRENT
// hierarchy order + status, so two concurrent workers can never escalate
// the same complaint twice or skip a level.
async function escalateComplaint(complaintId, { performedBy = null, reason = 'SLA deadline passed', manual = false } = {}) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return { escalated: false, reason: 'NOT_FOUND' };
  if (['RESOLVED', 'CANCELLED'].includes(complaint.status)) {
    return { escalated: false, reason: 'TERMINAL_STATUS' };
  }

  const category = await ComplaintCategory.findById(complaint.categoryId);
  const nextLevel = await hierarchyService.getNextLevel(
    complaint.organizationId,
    complaint.hierarchyScopeDepartmentId,
    complaint.currentHierarchyOrder
  );

  if (!nextLevel) {
    // Maximum escalation reached — flag for admin, never loop forever.
    const updated = await Complaint.findOneAndUpdate(
      { _id: complaint._id, currentHierarchyOrder: complaint.currentHierarchyOrder, maxEscalationReached: false },
      { $set: { maxEscalationReached: true } },
      { new: true }
    );
    if (updated) {
      await ComplaintHistory.create({
        complaintId: complaint._id,
        organizationId: complaint.organizationId,
        performedBy,
        action: 'Maximum Escalation Reached',
        previousStatus: complaint.status,
        newStatus: complaint.status,
        previousLevel: complaint.currentHierarchyOrder,
        newLevel: complaint.currentHierarchyOrder,
        reason: 'No further hierarchy level configured.',
      });
      const admins = await getOrgAdminUsers(complaint.organizationId);
      await notificationService.notifyMany(
        admins.map((a) => a._id),
        {
          organizationId: complaint.organizationId,
          type: 'MAX_ESCALATION_REACHED',
          title: 'Maximum escalation reached',
          message: `Complaint "${complaint.title}" has reached the top of the hierarchy and needs admin intervention.`,
          complaintId: complaint._id,
        }
      );
    }
    return { escalated: false, reason: 'MAX_ESCALATION' };
  }

  const authority = await hierarchyService.findAuthorityUser({
    organizationId: complaint.organizationId,
    positionId: nextLevel.positionId._id,
    departmentId: complaint.departmentId,
    organizationalUnitId: complaint.organizationalUnitId,
  });

  const newDeadline = slaService.computeEscalatedDeadline({
    categorySlaHours: category ? category.slaHours : 48,
    nextLevelSlaHours: nextLevel.slaHours,
  });

  const previousAssignee = complaint.currentAssignee;
  const previousLevel = complaint.currentHierarchyOrder;
  const previousStatus = complaint.status;

  // Atomic guard: only escalate if the complaint is STILL at the level/status
  // we read. If another worker already moved it, this update matches 0 docs.
  const updated = await Complaint.findOneAndUpdate(
    {
      _id: complaint._id,
      currentHierarchyOrder: previousLevel,
      status: { $in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
    },
    {
      $set: {
        currentHierarchyOrder: nextLevel.order,
        currentAssignee: authority ? authority._id : null,
        currentPositionId: nextLevel.positionId._id,
        status: 'ESCALATED',
        slaDeadline: newDeadline,
        lastEscalatedAt: new Date(),
        slaWarningSent: false,
      },
      $inc: { escalationCount: 1 },
    },
    { new: true }
  );

  if (!updated) {
    // Lost the race to another execution — safe no-op.
    return { escalated: false, reason: 'ALREADY_ESCALATED' };
  }

  await ComplaintHistory.create({
    complaintId: complaint._id,
    organizationId: complaint.organizationId,
    performedBy,
    action: manual ? 'Manually Escalated' : 'Automatically Escalated',
    previousStatus,
    newStatus: 'ESCALATED',
    previousAssignee,
    newAssignee: authority ? authority._id : null,
    previousLevel,
    newLevel: nextLevel.order,
    reason,
  });

  if (previousAssignee) {
    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: previousAssignee,
      type: 'COMPLAINT_ESCALATED',
      title: 'Complaint escalated past your level',
      message: `Complaint "${complaint.title}" has been escalated to the next level.`,
      complaintId: complaint._id,
    });
  }
  await notificationService.notify({
    organizationId: complaint.organizationId,
    userId: complaint.submittedBy,
    type: 'COMPLAINT_ESCALATED',
    title: 'Your complaint was escalated',
    message: `Your complaint "${complaint.title}" has been escalated to the next authority level.`,
    complaintId: complaint._id,
  });
  if (authority) {
    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: authority._id,
      type: 'COMPLAINT_ASSIGNED',
      title: 'Escalated complaint assigned to you',
      message: `Complaint "${complaint.title}" has been escalated to you.`,
      complaintId: complaint._id,
    });
  }

  return { escalated: true, complaint: updated };
}

// Finds all complaints whose SLA has passed and are not in a terminal state.
async function findExpiredComplaints() {
  return Complaint.find({
    status: { $in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
    slaDeadline: { $lt: new Date() },
    maxEscalationReached: false,
  }).select('_id');
}

module.exports = { escalateComplaint, findExpiredComplaints };
