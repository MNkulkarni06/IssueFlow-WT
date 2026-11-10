const { Complaint } = require('../models');

async function organizationOverview(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const [total, open, inProgress, escalated, resolved, cancelled, slaBreached] = await Promise.all([
      Complaint.countDocuments({ organizationId }),
      Complaint.countDocuments({ organizationId, status: 'OPEN' }),
      Complaint.countDocuments({ organizationId, status: 'IN_PROGRESS' }),
      Complaint.countDocuments({ organizationId, status: 'ESCALATED' }),
      Complaint.countDocuments({ organizationId, status: 'RESOLVED' }),
      Complaint.countDocuments({ organizationId, status: 'CANCELLED' }),
      Complaint.countDocuments({ organizationId, status: { $in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }, slaDeadline: { $lt: new Date() } }),
    ]);

    const resolvedComplaints = await Complaint.find({ organizationId, status: 'RESOLVED', resolvedAt: { $ne: null } }).select('createdAt resolvedAt');
    const avgResolutionHours = resolvedComplaints.length
      ? resolvedComplaints.reduce((sum, c) => sum + (c.resolvedAt - c.createdAt) / 3600000, 0) / resolvedComplaints.length
      : 0;

    const escalationRate = total ? Number((((await Complaint.countDocuments({ organizationId, escalationCount: { $gt: 0 } })) / total) * 100).toFixed(1)) : 0;

    res.json({
      total,
      open,
      inProgress,
      escalated,
      resolved,
      cancelled,
      slaBreached,
      avgResolutionHours: Number(avgResolutionHours.toFixed(1)),
      escalationRate,
    });
  } catch (err) {
    next(err);
  }
}

async function complaintsBreakdown(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const [byCategory, byDepartment, byLevel, byPriority] = await Promise.all([
      Complaint.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'complaintcategories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: '$category.name', count: 1 } },
      ]),
      Complaint.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: { $ifNull: ['$department.name', 'Unassigned'] }, count: 1 } },
      ]),
      Complaint.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$currentHierarchyOrder', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, level: '$_id', count: 1 } },
      ]),
      Complaint.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $project: { _id: 0, priority: '$_id', count: 1 } },
      ]),
    ]);

    res.json({ byCategory, byDepartment, byLevel, byPriority });
  } catch (err) {
    next(err);
  }
}

async function escalationsBreakdown(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const totalEscalated = await Complaint.countDocuments({ organizationId, escalationCount: { $gt: 0 } });
    const maxEscalationReached = await Complaint.countDocuments({ organizationId, maxEscalationReached: true });
    const avgEscalations = await Complaint.aggregate([
      { $match: { organizationId } },
      { $group: { _id: null, avg: { $avg: '$escalationCount' } } },
    ]);

    res.json({
      totalEscalated,
      maxEscalationReached,
      avgEscalationCount: avgEscalations[0] ? Number(avgEscalations[0].avg.toFixed(2)) : 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { organizationOverview, complaintsBreakdown, escalationsBreakdown };
