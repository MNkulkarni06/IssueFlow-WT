const { Complaint, ComplaintCategory, ComplaintHistory } = require('../models');
const hierarchyService = require('./hierarchyService');
const slaService = require('./slaService');
const notificationService = require('./notificationService');
const { getOrgAdminUsers } = require('./organizationService');

async function createComplaint({ user, title, description, categoryId, departmentId: requestedDepartmentId, organizationalUnitId, priority, attachments }) {
  const organizationId = user.organizationId;

  const category = await ComplaintCategory.findOne({ _id: categoryId, organizationId, status: 'ACTIVE' });
  if (!category) {
    const err = new Error('Invalid category for this organization.');
    err.status = 400;
    throw err;
  }

  // The category's default department wins; otherwise use what the user picked.
  const departmentId = category.defaultDepartmentId || requestedDepartmentId || null;

  const scopeDepartmentId = await hierarchyService.resolveChainScope(organizationId, departmentId);
  const firstLevel = await hierarchyService.getFirstLevel(organizationId, scopeDepartmentId);
  if (!firstLevel) {
    const err = new Error('No escalation hierarchy configured for this organization/department yet.');
    err.status = 400;
    throw err;
  }

  const authority = await hierarchyService.findAuthorityUser({
    organizationId,
    positionId: firstLevel.positionId._id,
    departmentId,
    organizationalUnitId,
  });

  const slaDeadline = slaService.computeInitialDeadline({
    categorySlaHours: category.slaHours,
    firstLevelSlaHours: firstLevel.slaHours,
  });

  const complaint = await Complaint.create({
    organizationId,
    title,
    description,
    categoryId,
    submittedBy: user._id,
    departmentId: departmentId || null,
    organizationalUnitId: organizationalUnitId || null,
    hierarchyScopeDepartmentId: scopeDepartmentId,
    currentHierarchyOrder: firstLevel.order,
    currentAssignee: authority ? authority._id : null,
    currentPositionId: firstLevel.positionId._id,
    status: 'OPEN',
    priority: priority || category.priority,
    slaDeadline,
    attachments: attachments || [],
  });

  await ComplaintHistory.create({
    complaintId: complaint._id,
    organizationId,
    performedBy: user._id,
    action: 'Complaint Created',
    previousStatus: null,
    newStatus: 'OPEN',
    previousAssignee: null,
    newAssignee: authority ? authority._id : null,
    previousLevel: null,
    newLevel: firstLevel.order,
    reason: '',
  });

  await notificationService.notify({
    organizationId,
    userId: user._id,
    type: 'COMPLAINT_CREATED',
    title: 'Complaint submitted',
    message: `Your complaint "${title}" has been submitted.`,
    complaintId: complaint._id,
  });

  if (authority) {
    await notificationService.notify({
      organizationId,
      userId: authority._id,
      type: 'COMPLAINT_ASSIGNED',
      title: 'New complaint assigned to you',
      message: `Complaint "${title}" has been assigned to you.`,
      complaintId: complaint._id,
    });
  } else {
    // No authority found at the first level — flag org admins immediately.
    const admins = await getOrgAdminUsers(organizationId);
    await notificationService.notifyMany(
      admins.map((a) => a._id),
      {
        organizationId,
        type: 'MAX_ESCALATION_REACHED',
        title: 'No authority found',
        message: `Complaint "${title}" has no authority configured at Level ${firstLevel.order}. Admin intervention needed.`,
        complaintId: complaint._id,
      }
    );
  }

  return complaint;
}

// Enforces valid status transitions on the backend (never trust frontend).
const ALLOWED_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['ESCALATED', 'RESOLVED', 'CANCELLED'],
  ESCALATED: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: [],
};

function assertTransition(from, to) {
  if (!ALLOWED_TRANSITIONS[from] || !ALLOWED_TRANSITIONS[from].includes(to)) {
    const err = new Error(`Cannot transition complaint from ${from} to ${to}.`);
    err.status = 400;
    throw err;
  }
}

module.exports = { createComplaint, assertTransition, ALLOWED_TRANSITIONS };
