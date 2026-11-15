const { User, Position } = require('../models');
const { logAudit } = require('../services/auditService');

// Resolves the organization scope for a request: system admins may target
// any organization via ?organizationId=..., everyone else is locked to
// their own req.organizationId. This is the tenant-isolation enforcement
// point for all user operations.
function scopedOrgId(req) {
  if (req.isSystemAdmin) return req.query.organizationId || req.body.organizationId || null;
  return req.organizationId;
}

async function listUsers(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });
    const users = await User.find({ organizationId }).populate('roleId departmentId').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    const user = await User.findOne({ _id: req.params.id, organizationId }).populate('roleId departmentId');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    if (!organizationId) return res.status(400).json({ message: 'organizationId is required.' });

    const { name, email, password, phone, roleId, departmentId, organizationalUnitId, designation, employeeId } = req.body;
    if (!name || !email || !password || !roleId) {
      return res.status(400).json({ message: 'name, email, password and roleId are required.' });
    }

    const position = await Position.findOne({ _id: roleId, organizationId });
    if (!position) return res.status(400).json({ message: 'roleId does not belong to this organization.' });

    const existing = await User.findOne({ organizationId, email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'A user with this email already exists in this organization.' });

    const user = await User.create({
      organizationId,
      name,
      email: email.toLowerCase(),
      password,
      phone,
      roleId,
      departmentId: departmentId || null,
      organizationalUnitId: organizationalUnitId || null,
      designation,
      employeeId,
    });

    await logAudit({
      organizationId,
      performedBy: req.user._id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: user._id,
      details: { email: user.email, roleId },
    });

    const clean = user.toObject();
    delete clean.password;
    res.status(201).json({ user: clean });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    const allowed = ['name', 'phone', 'roleId', 'departmentId', 'organizationalUnitId', 'designation', 'employeeId'];
    const update = {};
    for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f];

    if (update.roleId) {
      const position = await Position.findOne({ _id: update.roleId, organizationId });
      if (!position) return res.status(400).json({ message: 'roleId does not belong to this organization.' });
    }

    const user = await User.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: update }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (update.roleId) {
      await logAudit({
        organizationId,
        performedBy: req.user._id,
        action: 'USER_ROLE_CHANGED',
        targetType: 'User',
        targetId: user._id,
        details: { newRoleId: update.roleId },
      });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });

    const user = await User.findOneAndUpdate({ _id: req.params.id, organizationId }, { $set: { status } }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, updateStatus };
