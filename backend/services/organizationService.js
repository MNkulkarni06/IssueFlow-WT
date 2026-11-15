const { User, Position } = require('../models');

async function getOrgAdminUsers(organizationId) {
  const adminPositions = await Position.find({ organizationId, isOrgAdmin: true }).select('_id');
  const positionIds = adminPositions.map((p) => p._id);
  if (positionIds.length === 0) return [];
  return User.find({ organizationId, roleId: { $in: positionIds }, status: 'ACTIVE' });
}

module.exports = { getOrgAdminUsers };
