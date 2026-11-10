const { OrganizationalUnit, Organization } = require('../models');

async function list(req, res, next) {
  try {
    const organizationId = req.isSystemAdmin ? req.query.organizationId : req.organizationId;
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const units = await OrganizationalUnit.find({ organizationId, status: 'ACTIVE' }).sort({ name: 1 });
    res.json({ units });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const { name, type, parentUnitId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required.' });

    const unit = await OrganizationalUnit.create({ organizationId, name, type, parentUnitId: parentUnitId || null });
    await Organization.updateOne({ _id: organizationId }, { $set: { 'settings.usesOrganizationalUnits': true } });
    res.status(201).json({ unit });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const allowed = ['name', 'type', 'parentUnitId', 'status'];
    const upd = {};
    for (const f of allowed) if (req.body[f] !== undefined) upd[f] = req.body[f];
    const unit = await OrganizationalUnit.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: upd }, { new: true });
    if (!unit) return res.status(404).json({ message: 'Unit not found.' });
    res.json({ unit });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId;
    const unit = await OrganizationalUnit.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: { status: 'INACTIVE' } }, { new: true });
    if (!unit) return res.status(404).json({ message: 'Unit not found.' });
    res.json({ message: 'Unit deactivated.', unit });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
