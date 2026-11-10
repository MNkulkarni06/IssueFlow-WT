const { Organization, User, Position } = require('../models');
const { logAudit } = require('../services/auditService');

// SYSTEM ADMIN: create a new organization (platform-level onboarding).
async function createOrganization(req, res, next) {
  try {
    const { name, type, description, contactEmail, contactPhone, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Organization name is required.' });

    const org = await Organization.create({ name, type, description, contactEmail, contactPhone, address });

    await logAudit({
      organizationId: org._id,
      performedBy: req.user._id,
      action: 'ORGANIZATION_CREATED',
      targetType: 'Organization',
      targetId: org._id,
      details: { name, type },
    });

    res.status(201).json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// SYSTEM ADMIN: list all organizations (platform-wide view).
async function listOrganizations(req, res, next) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    res.json({ organizations: orgs });
  } catch (err) {
    next(err);
  }
}

// Get a single organization. Org admins may only fetch their OWN org;
// system admins may fetch any.
async function getOrganization(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.isSystemAdmin && String(req.organizationId) !== String(id)) {
      return res.status(403).json({ message: 'Cannot access another organization.' });
    }
    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: 'Organization not found.' });
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// Update organization (system admin: any org & status; org admin: own org,
// profile/settings fields only).
async function updateOrganization(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.isSystemAdmin && String(req.organizationId) !== String(id)) {
      return res.status(403).json({ message: 'Cannot modify another organization.' });
    }

    const allowedFields = ['name', 'description', 'logo', 'contactEmail', 'contactPhone', 'address', 'settings'];
    if (req.isSystemAdmin) allowedFields.push('status', 'type');

    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    const org = await Organization.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!org) return res.status(404).json({ message: 'Organization not found.' });

    await logAudit({
      organizationId: org._id,
      performedBy: req.user._id,
      action: 'ORGANIZATION_UPDATED',
      targetType: 'Organization',
      targetId: org._id,
      details: update,
    });

    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// Platform-wide stats for the System Admin dashboard.
async function systemStats(req, res, next) {
  try {
    const { Complaint } = require('../models');
    const [totalOrgs, activeOrgs, totalUsers, totalComplaints, escalatedComplaints, resolvedComplaints] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ status: 'ACTIVE' }),
      User.countDocuments({ systemRole: 'NONE' }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ escalationCount: { $gt: 0 } }),
      Complaint.countDocuments({ status: 'RESOLVED' }),
    ]);

    res.json({
      totalOrganizations: totalOrgs,
      activeOrganizations: activeOrgs,
      totalUsers,
      totalComplaints,
      totalEscalations: escalatedComplaints,
      resolutionRate: totalComplaints ? Number(((resolvedComplaints / totalComplaints) * 100).toFixed(1)) : 0,
    });
  } catch (err) {
    next(err);
  }
}

// SYSTEM ADMIN: bootstrap the first Organization Admin position + user for a
// newly created organization, so the org admin can log in and run the setup
// wizard (departments, positions, hierarchy, categories, SLA, users).
async function createOrgAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required.' });
    }

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: 'Organization not found.' });

    let adminPosition = await Position.findOne({ organizationId: id, isOrgAdmin: true });
    if (!adminPosition) {
      const { PERMISSIONS } = require('../utils/permissions');
      adminPosition = await Position.create({
        organizationId: id,
        name: 'Organization Admin',
        description: 'Full administrative control over this organization.',
        permissions: PERMISSIONS,
        isOrgAdmin: true,
      });
    }

    const existing = await User.findOne({ organizationId: id, email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'A user with this email already exists in this organization.' });

    const user = await User.create({ organizationId: id, name, email: email.toLowerCase(), password, roleId: adminPosition._id });

    await logAudit({ organizationId: id, performedBy: req.user._id, action: 'USER_CREATED', targetType: 'User', targetId: user._id, details: { email, role: 'Organization Admin' } });

    const clean = user.toObject();
    delete clean.password;
    res.status(201).json({ user: clean, position: adminPosition });
  } catch (err) {
    next(err);
  }
}

// PUBLIC: minimal list of active organizations, for the self-registration
// screen (organization + name only — no sensitive data).
async function listPublicOrganizations(req, res, next) {
  try {
    const orgs = await Organization.find({ status: 'ACTIVE' }).select('name type').sort({ name: 1 });
    res.json({ organizations: orgs });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrganization,
  listOrganizations,
  getOrganization,
  updateOrganization,
  systemStats,
  createOrgAdmin,
  listPublicOrganizations,
};
