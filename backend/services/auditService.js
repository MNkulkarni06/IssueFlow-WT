const { AuditLog } = require('../models');

async function logAudit({ organizationId = null, performedBy = null, action, targetType = '', targetId = null, details = {} }) {
  return AuditLog.create({ organizationId, performedBy, action, targetType, targetId, details });
}

module.exports = { logAudit };
