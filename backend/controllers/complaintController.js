const { Complaint, ComplaintHistory, Notification } = require('../models');
const complaintService = require('../services/complaintService');
const escalationService = require('../services/escalationService');
const notificationService = require('../services/notificationService');

// submittedBy / currentAssignee may be a raw ObjectId or a populated User document.
function idOf(value) {
  if (!value) return null;
  return String(value._id || value);
}

function canViewComplaint(req, complaint) {
  if (req.isSystemAdmin) return false; // system admin manages platform, not tenant data, by design
  if ((req.permissions || []).includes('VIEW_ALL_COMPLAINTS')) return true;
  if (idOf(complaint.submittedBy) === String(req.user._id) && (req.permissions || []).includes('VIEW_OWN_COMPLAINT')) return true;
  if (idOf(complaint.currentAssignee) === String(req.user._id) && (req.permissions || []).includes('VIEW_ASSIGNED_COMPLAINT')) return true;
  return false;
}

async function create(req, res, next) {
  try {
    const { title, description, categoryId, departmentId, organizationalUnitId, priority } = req.body;
    if (!title || !description || !categoryId) {
      return res.status(400).json({ message: 'title, description and categoryId are required.' });
    }

    const attachments = (req.files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
      path: `/uploads/${f.filename}`,
    }));

    const complaint = await complaintService.createComplaint({
      user: req.user,
      title,
      description,
      categoryId,
      departmentId: departmentId || null,
      organizationalUnitId: organizationalUnitId || null,
      priority,
      attachments,
    });

    res.status(201).json({ complaint });
  } catch (err) {
    next(err);
  }
}

// Server-side search / filter / pagination — tenant-scoped by req.organizationId always.
async function list(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { status, category, priority, department, assignee, hierarchyLevel, search, slaStatus, page = 1, limit = 20, scope } = req.query;

    const query = { organizationId };

    if (!(req.permissions || []).includes('VIEW_ALL_COMPLAINTS')) {
      // Restrict to complaints the user is allowed to see.
      const or = [];
      if ((req.permissions || []).includes('VIEW_OWN_COMPLAINT')) or.push({ submittedBy: req.user._id });
      if ((req.permissions || []).includes('VIEW_ASSIGNED_COMPLAINT')) or.push({ currentAssignee: req.user._id });
      if (or.length === 0) return res.json({ complaints: [], total: 0, page: 1, pages: 0 });
      query.$or = or;
    } else if (scope === 'mine') {
      query.submittedBy = req.user._id;
    } else if (scope === 'assigned') {
      query.currentAssignee = req.user._id;
    }

    if (status) query.status = status;
    if (category) query.categoryId = category;
    if (priority) query.priority = priority;
    if (department) query.departmentId = department;
    if (assignee) query.currentAssignee = assignee;
    if (hierarchyLevel) query.currentHierarchyOrder = Number(hierarchyLevel);
    if (search) query.$text = { $search: search };
    if (slaStatus === 'breached') query.slaDeadline = { $lt: new Date() };
    if (slaStatus === 'ontrack') query.slaDeadline = { $gte: new Date() };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate('categoryId departmentId submittedBy currentAssignee currentPositionId')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Complaint.countDocuments(query),
    ]);

    res.json({ complaints, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('categoryId departmentId submittedBy currentAssignee currentPositionId organizationalUnitId');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canViewComplaint(req, complaint)) return res.status(403).json({ message: 'You cannot view this complaint.' });
    res.json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canViewComplaint(req, complaint)) return res.status(403).json({ message: 'You cannot view this complaint.' });

    const history = await ComplaintHistory.find({ complaintId: complaint._id })
      .sort({ timestamp: 1 })
      .populate('performedBy previousAssignee newAssignee');
    res.json({ history });
  } catch (err) {
    next(err);
  }
}

function assertAssigneeOrAdmin(req, complaint) {
  const isAssignee = idOf(complaint.currentAssignee) === String(req.user._id);
  const isAdmin = (req.permissions || []).includes('MANAGE_ORGANIZATION');
  if (!isAssignee && !isAdmin) {
    const err = new Error('Only the current assignee or an organization admin can perform this action.');
    err.status = 403;
    throw err;
  }
}

async function acknowledge(req, res, next) {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    assertAssigneeOrAdmin(req, complaint);

    await ComplaintHistory.create({
      complaintId: complaint._id,
      organizationId: complaint.organizationId,
      performedBy: req.user._id,
      action: 'Acknowledged',
      previousStatus: complaint.status,
      newStatus: complaint.status,
      previousLevel: complaint.currentHierarchyOrder,
      newLevel: complaint.currentHierarchyOrder,
    });

    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: complaint.submittedBy,
      type: 'COMPLAINT_ACKNOWLEDGED',
      title: 'Complaint acknowledged',
      message: `Your complaint "${complaint.title}" has been acknowledged.`,
      complaintId: complaint._id,
    });

    res.json({ message: 'Acknowledged.', complaint });
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    assertAssigneeOrAdmin(req, complaint);
    complaintService.assertTransition(complaint.status, 'IN_PROGRESS');

    const previousStatus = complaint.status;
    complaint.status = 'IN_PROGRESS';
    await complaint.save();

    await ComplaintHistory.create({
      complaintId: complaint._id,
      organizationId: complaint.organizationId,
      performedBy: req.user._id,
      action: 'Work Started',
      previousStatus,
      newStatus: 'IN_PROGRESS',
      previousLevel: complaint.currentHierarchyOrder,
      newLevel: complaint.currentHierarchyOrder,
    });

    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: complaint.submittedBy,
      type: 'COMPLAINT_STARTED',
      title: 'Work started on your complaint',
      message: `Work has started on your complaint "${complaint.title}".`,
      complaintId: complaint._id,
    });

    res.json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function addRemark(req, res, next) {
  try {
    const { remark } = req.body;
    if (!remark) return res.status(400).json({ message: 'remark is required.' });
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canViewComplaint(req, complaint)) return res.status(403).json({ message: 'Not permitted.' });

    await ComplaintHistory.create({
      complaintId: complaint._id,
      organizationId: complaint.organizationId,
      performedBy: req.user._id,
      action: 'Remark Added',
      previousStatus: complaint.status,
      newStatus: complaint.status,
      previousLevel: complaint.currentHierarchyOrder,
      newLevel: complaint.currentHierarchyOrder,
      reason: remark,
    });

    res.json({ message: 'Remark added.' });
  } catch (err) {
    next(err);
  }
}

async function resolve(req, res, next) {
  try {
    const { resolutionRemarks } = req.body;
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    assertAssigneeOrAdmin(req, complaint);
    complaintService.assertTransition(complaint.status, 'RESOLVED');

    const previousStatus = complaint.status;
    complaint.status = 'RESOLVED';
    complaint.resolvedAt = new Date();
    complaint.resolutionRemarks = resolutionRemarks || '';
    await complaint.save();

    await ComplaintHistory.create({
      complaintId: complaint._id,
      organizationId: complaint.organizationId,
      performedBy: req.user._id,
      action: 'Complaint Resolved',
      previousStatus,
      newStatus: 'RESOLVED',
      previousLevel: complaint.currentHierarchyOrder,
      newLevel: complaint.currentHierarchyOrder,
      reason: resolutionRemarks || '',
    });

    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: complaint.submittedBy,
      type: 'COMPLAINT_RESOLVED',
      title: 'Complaint resolved',
      message: `Your complaint "${complaint.title}" has been resolved.`,
      complaintId: complaint._id,
    });

    res.json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const { reason } = req.body;
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });

    const isSubmitter = idOf(complaint.submittedBy) === String(req.user._id);
    const isAdmin = (req.permissions || []).includes('MANAGE_ORGANIZATION');
    const hasPerm = (req.permissions || []).includes('CANCEL_COMPLAINT');
    if (!isAdmin && !(isSubmitter && hasPerm)) {
      return res.status(403).json({ message: 'Not permitted to cancel this complaint.' });
    }
    complaintService.assertTransition(complaint.status, 'CANCELLED');

    const previousStatus = complaint.status;
    complaint.status = 'CANCELLED';
    await complaint.save();

    await ComplaintHistory.create({
      complaintId: complaint._id,
      organizationId: complaint.organizationId,
      performedBy: req.user._id,
      action: 'Complaint Cancelled',
      previousStatus,
      newStatus: 'CANCELLED',
      previousLevel: complaint.currentHierarchyOrder,
      newLevel: complaint.currentHierarchyOrder,
      reason: reason || '',
    });

    await notificationService.notify({
      organizationId: complaint.organizationId,
      userId: complaint.submittedBy,
      type: 'COMPLAINT_CANCELLED',
      title: 'Complaint cancelled',
      message: `Complaint "${complaint.title}" has been cancelled.`,
      complaintId: complaint._id,
    });

    res.json({ complaint });
  } catch (err) {
    next(err);
  }
}

// Manual escalation by an authority/org admin holding MANUAL_ESCALATE.
async function manualEscalate(req, res, next) {
  try {
    const { reason } = req.body;
    const complaint = await Complaint.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });

    const isAdmin = (req.permissions || []).includes('MANAGE_ORGANIZATION');
    const isAssigneeWithPerm = idOf(complaint.currentAssignee) === String(req.user._id)
      && (req.permissions || []).includes('MANUAL_ESCALATE');
    if (!isAdmin && !isAssigneeWithPerm) {
      return res.status(403).json({ message: 'Not permitted to escalate this complaint.' });
    }

    const result = await escalationService.escalateComplaint(complaint._id, {
      performedBy: req.user._id,
      reason: reason || 'Manually escalated by authority.',
      manual: true,
    });

    if (!result.escalated) {
      return res.status(400).json({ message: `Could not escalate: ${result.reason}` });
    }
    res.json({ complaint: result.complaint });
  } catch (err) {
    next(err);
  }
}

// DEVELOPMENT-ONLY: allows setting the SLA deadline to a near-future time so
// automatic escalation can be demonstrated without waiting. Backend
// timestamps remain the sole authority — this only rewrites slaDeadline.
async function devSetDeadline(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Not available in production.' });
    }
    const { minutesFromNow = 1 } = req.body;
    const isAdmin = (req.permissions || []).includes('MANAGE_ORGANIZATION') || (req.permissions || []).includes('MANUAL_ESCALATE');
    if (!isAdmin) return res.status(403).json({ message: 'Not permitted.' });

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      { $set: { slaDeadline: new Date(Date.now() + minutesFromNow * 60 * 1000), slaWarningSent: false } },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    res.json({ message: `SLA deadline set to ${minutesFromNow} minute(s) from now. The escalation cron job will pick it up automatically.`, complaint });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, getHistory, acknowledge, start, addRemark, resolve, cancel, manualEscalate, devSetDeadline };
