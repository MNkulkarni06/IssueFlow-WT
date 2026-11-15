const { HierarchyLevel } = require('../models');
const { logAudit } = require('../services/auditService');

// GET /api/hierarchy?departmentId=<id|null>
// Returns the ordered chain for either the org-wide default (no
// departmentId) or a specific department's dedicated chain.
async function list(req, res, next) {
  try {
    const organizationId = req.isSystemAdmin ? req.query.organizationId : req.organizationId;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });

    const scopeDepartmentId = req.query.departmentId || null;
    const levels = await HierarchyLevel.find({ organizationId, scopeDepartmentId, status: 'ACTIVE' })
      .sort({ order: 1 })
      .populate('positionId')
      .populate('scopeDepartmentId');
    res.json({ levels });
  } catch (err) {
    next(err);
  }
}

// GET /api/hierarchy/all — every configured chain, grouped by scope, for the
// hierarchy visualization page.
async function listAll(req, res, next) {
  try {
    const organizationId = req.isSystemAdmin ? req.query.organizationId : req.organizationId;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });

    const levels = await HierarchyLevel.find({ organizationId }).sort({ order: 1 }).populate('positionId').populate('scopeDepartmentId');
    const grouped = {};
    for (const level of levels) {
      const key = level.scopeDepartmentId ? String(level.scopeDepartmentId._id || level.scopeDepartmentId) : 'DEFAULT';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(level);
    }
    res.json({ grouped });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { label, positionId, scopeDepartmentId, slaHours, order } = req.body;
    if (!label || !positionId) return res.status(400).json({ message: 'label and positionId are required.' });

    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const last = await HierarchyLevel.findOne({ organizationId, scopeDepartmentId: scopeDepartmentId || null }).sort({ order: -1 });
      finalOrder = last ? last.order + 1 : 1;
    }

    const level = await HierarchyLevel.create({
      organizationId,
      scopeDepartmentId: scopeDepartmentId || null,
      order: finalOrder,
      label,
      positionId,
      slaHours: slaHours ?? null,
    });

    await logAudit({ organizationId, performedBy: req.user._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', targetId: level._id, details: { label, order: finalOrder } });
    res.status(201).json({ level: await level.populate('positionId') });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const allowed = ['label', 'positionId', 'slaHours', 'order', 'status'];
    const upd = {};
    for (const f of allowed) if (req.body[f] !== undefined) upd[f] = req.body[f];

    const level = await HierarchyLevel.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: upd }, { new: true }).populate('positionId');
    if (!level) return res.status(404).json({ message: 'Hierarchy level not found.' });

    await logAudit({ organizationId, performedBy: req.user._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', targetId: level._id, details: upd });
    res.json({ level });
  } catch (err) {
    next(err);
  }
}

// Reorders an entire chain in one call: body = { scopeDepartmentId, orderedIds: [levelId,...] }
async function reorder(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { scopeDepartmentId = null, orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ message: 'orderedIds array is required.' });
    }

    // Two-phase update avoids unique-index collisions during reorder.
    await Promise.all(
      orderedIds.map((id, idx) => HierarchyLevel.updateOne({ _id: id, organizationId }, { $set: { order: 1000 + idx } }))
    );
    await Promise.all(
      orderedIds.map((id, idx) => HierarchyLevel.updateOne({ _id: id, organizationId }, { $set: { order: idx + 1 } }))
    );

    const levels = await HierarchyLevel.find({ organizationId, scopeDepartmentId }).sort({ order: 1 }).populate('positionId');
    await logAudit({ organizationId, performedBy: req.user._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', details: { reordered: orderedIds } });
    res.json({ levels });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const level = await HierarchyLevel.findOneAndUpdate(
      { _id: req.params.id, organizationId },
      { $set: { status: 'INACTIVE' } },
      { new: true }
    );
    if (!level) return res.status(404).json({ message: 'Hierarchy level not found.' });
    await logAudit({ organizationId, performedBy: req.user._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', targetId: level._id, details: { deactivated: true } });
    res.json({ message: 'Level deactivated.', level });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listAll, create, update, reorder, remove };
