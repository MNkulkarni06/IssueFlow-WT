const { ComplaintCategory } = require('../models');
const { logAudit } = require('../services/auditService');

async function list(req, res, next) {
  try {
    const organizationId = req.isSystemAdmin ? req.query.organizationId : req.organizationId;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const categories = await ComplaintCategory.find({ organizationId, status: 'ACTIVE' }).populate('defaultDepartmentId').sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { name, description, priority, slaHours, defaultDepartmentId } = req.body;
    if (!name || !slaHours) return res.status(400).json({ message: 'name and slaHours are required.' });

    const category = await ComplaintCategory.create({ organizationId, name, description, priority, slaHours, defaultDepartmentId: defaultDepartmentId || null });
    await logAudit({ organizationId, performedBy: req.user._id, action: 'CATEGORY_CHANGED', targetType: 'ComplaintCategory', targetId: category._id, details: { name, slaHours } });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const allowed = ['name', 'description', 'priority', 'slaHours', 'status', 'defaultDepartmentId'];
    const upd = {};
    for (const f of allowed) if (req.body[f] !== undefined) upd[f] = req.body[f];

    const category = await ComplaintCategory.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: upd }, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    await logAudit({ organizationId, performedBy: req.user._id, action: 'CATEGORY_CHANGED', targetType: 'ComplaintCategory', targetId: category._id, details: upd });
    res.json({ category });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const category = await ComplaintCategory.findOneAndUpdate(
      { _id: req.params.id, organizationId },
      { $set: { status: 'INACTIVE' } },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ message: 'Category deactivated.', category });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
