const { Position } = require('../models');
const { PERMISSIONS } = require('../utils/permissions');
const { logAudit } = require('../services/auditService');

async function list(req, res, next) {
  try {
    const organizationId = req.isSystemAdmin ? req.query.organizationId : req.organizationId;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const positions = await Position.find({ organizationId }).populate('departmentId').sort({ createdAt: 1 });
    res.json({ positions, availablePermissions: PERMISSIONS });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { name, description, departmentId, permissions, isEndUserRole, isOrgAdmin } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required.' });

    const invalid = (permissions || []).filter((p) => !PERMISSIONS.includes(p));
    if (invalid.length) return res.status(400).json({ message: `Unknown permissions: ${invalid.join(', ')}` });

    const position = await Position.create({
      organizationId,
      name,
      description,
      departmentId: departmentId || null,
      permissions: permissions || [],
      isEndUserRole: !!isEndUserRole,
      isOrgAdmin: !!isOrgAdmin,
    });

    await logAudit({ organizationId, performedBy: req.user._id, action: 'POSITION_CREATED', targetType: 'Position', targetId: position._id, details: { name } });
    res.status(201).json({ position });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const allowed = ['name', 'description', 'departmentId', 'permissions', 'isEndUserRole', 'isOrgAdmin', 'status'];
    const upd = {};
    for (const f of allowed) if (req.body[f] !== undefined) upd[f] = req.body[f];

    if (upd.permissions) {
      const invalid = upd.permissions.filter((p) => !PERMISSIONS.includes(p));
      if (invalid.length) return res.status(400).json({ message: `Unknown permissions: ${invalid.join(', ')}` });
    }

    const position = await Position.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: upd }, { new: true });
    if (!position) return res.status(404).json({ message: 'Position not found.' });
    res.json({ position });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const position = await Position.findOneAndUpdate(
      { _id: req.params.id, organizationId },
      { $set: { status: 'INACTIVE' } },
      { new: true }
    );
    if (!position) return res.status(404).json({ message: 'Position not found.' });
    res.json({ message: 'Position deactivated.', position });
  } catch (err) {
    next(err);
  }
}

// PUBLIC: end-user-eligible positions for a given organization, used by the
// self-registration screen (e.g. "Customer", "Student", "Employee").
async function listPublicEndUserPositions(req, res, next) {
  try {
    const { organizationId } = req.query;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const positions = await Position.find({ organizationId, isEndUserRole: true, status: 'ACTIVE' }).select('name description departmentId');
    res.json({ positions });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, listPublicEndUserPositions };
