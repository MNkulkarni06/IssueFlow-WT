// requirePermission(...perms): user must hold at least ONE of the listed
// permissions on their organization Position, OR be a system admin.
function requirePermission(...perms) {
  return (req, res, next) => {
    if (req.isSystemAdmin) return next();
    const has = (req.permissions || []).some((p) => perms.includes(p));
    if (!has) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// System admin only (platform-level operations: manage organizations).
function requireSystemAdmin(req, res, next) {
  if (!req.isSystemAdmin) {
    return res.status(403).json({ message: 'System administrator access required.' });
  }
  next();
}

// Organization admin: a user with the MANAGE_ORGANIZATION permission,
// scoped to their own organization only.
function requireOrgAdmin(req, res, next) {
  if (req.isSystemAdmin) return next();
  if (!req.organizationId) {
    return res.status(403).json({ message: 'No organization context.' });
  }
  const has = (req.permissions || []).includes('MANAGE_ORGANIZATION');
  if (!has) {
    return res.status(403).json({ message: 'Organization administrator access required.' });
  }
  next();
}

// Hard tenant-isolation guard: blocks any request for a non-system-admin
// user who has no organization context at all.
function requireOrganizationContext(req, res, next) {
  if (req.isSystemAdmin) return next();
  if (!req.organizationId) {
    return res.status(403).json({ message: 'No organization context.' });
  }
  next();
}

module.exports = { requirePermission, requireSystemAdmin, requireOrgAdmin, requireOrganizationContext };
