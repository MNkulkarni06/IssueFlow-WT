const { Department } = require('../models');
const { logAudit } = require('../services/auditService');

function orgId(req) {
  return req.isSystemAdmin ? req.query.organizationId : req.organizationId;
}

async function list(req, res, next) {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const departments = await Department.find({ organizationId }).sort({ name: 1 });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const organizationId = req.organizationId || req.body.organizationId;
    const { name, description, parentDepartmentId, managerId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required.' });

    const dept = await Department.create({ organizationId, name, description, parentDepartmentId, managerId });
    await logAudit({ organizationId, performedBy: req.user._id, action: 'DEPARTMENT_CREATED', targetType: 'Department', targetId: dept._id, details: { name } });
    res.status(201).json({ department: dept });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const allowed = ['name', 'description', 'parentDepartmentId', 'managerId', 'status'];
    const upd = {};
    for (const f of allowed) if (req.body[f] !== undefined) upd[f] = req.body[f];

    const dept = await Department.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: upd }, { new: true });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });
    res.json({ department: dept });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const dept = await Department.findOneAndUpdate(
      { _id: req.params.id, organizationId },
      { $set: { status: 'INACTIVE' } },
      { new: true }
    );
    if (!dept) return res.status(404).json({ message: 'Department not found.' });
    res.json({ message: 'Department deactivated.', department: dept });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
