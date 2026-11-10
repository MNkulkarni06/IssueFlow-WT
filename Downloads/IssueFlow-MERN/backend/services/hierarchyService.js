const { HierarchyLevel, User } = require('../models');

// Determines which hierarchy CHAIN a complaint should follow: a department-
// specific chain if one is configured, otherwise the organization's default
// (department-less) chain. This is resolved ONCE at complaint creation time
// and stored on the complaint as `hierarchyScopeDepartmentId`.
async function resolveChainScope(organizationId, departmentId) {
  if (departmentId) {
    const hasDeptChain = await HierarchyLevel.exists({
      organizationId,
      scopeDepartmentId: departmentId,
      status: 'ACTIVE',
    });
    if (hasDeptChain) return departmentId;
  }
  return null; // default org-wide chain
}

async function getChain(organizationId, scopeDepartmentId) {
  return HierarchyLevel.find({ organizationId, scopeDepartmentId: scopeDepartmentId || null, status: 'ACTIVE' })
    .sort({ order: 1 })
    .populate('positionId');
}

async function getFirstLevel(organizationId, scopeDepartmentId) {
  return HierarchyLevel.findOne({ organizationId, scopeDepartmentId: scopeDepartmentId || null, status: 'ACTIVE' })
    .sort({ order: 1 })
    .populate('positionId');
}

async function getLevelByOrder(organizationId, scopeDepartmentId, order) {
  return HierarchyLevel.findOne({
    organizationId,
    scopeDepartmentId: scopeDepartmentId || null,
    order,
    status: 'ACTIVE',
  }).populate('positionId');
}

// The NEXT level strictly after currentOrder in this chain, if any.
async function getNextLevel(organizationId, scopeDepartmentId, currentOrder) {
  return HierarchyLevel.findOne({
    organizationId,
    scopeDepartmentId: scopeDepartmentId || null,
    order: { $gt: currentOrder },
    status: 'ACTIVE',
  })
    .sort({ order: 1 })
    .populate('positionId');
}

// Finds the actual authority USER who should handle a complaint at a given
// hierarchy level. Selection criteria (in order of preference):
//   organizationId + positionId  [+ departmentId]  [+ organizationalUnitId]
// This never branches on role name/org type — purely data-driven lookup.
async function findAuthorityUser({ organizationId, positionId, departmentId, organizationalUnitId }) {
  const baseQuery = { organizationId, roleId: positionId, status: 'ACTIVE' };

  // Prefer a user matching both department and branch/unit (most specific).
  if (departmentId && organizationalUnitId) {
    const exact = await User.findOne({ ...baseQuery, departmentId, organizationalUnitId });
    if (exact) return exact;
  }
  if (departmentId) {
    const byDept = await User.findOne({ ...baseQuery, departmentId });
    if (byDept) return byDept;
  }
  if (organizationalUnitId) {
    const byUnit = await User.findOne({ ...baseQuery, organizationalUnitId });
    if (byUnit) return byUnit;
  }
  // Fall back to any active user holding this position in the organization.
  return User.findOne(baseQuery);
}

module.exports = {
  resolveChainScope,
  getChain,
  getFirstLevel,
  getLevelByOrder,
  getNextLevel,
  findAuthorityUser,
};
