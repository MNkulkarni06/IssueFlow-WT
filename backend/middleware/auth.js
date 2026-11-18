
const jwt = require('jsonwebtoken');
const { User, Position, Organization } = require('../models');

// Verifies JWT and loads the current user.
// Also checks organization status on every authenticated request.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid token.';

      return res.status(401).json({ message });
    }

    const user = await User.findById(payload.userId);

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        message: 'Account not found or inactive.'
      });
    }

    // Block existing sessions if the organization is deactivated.
    // System Admin accounts have no organizationId.
    if (user.organizationId) {
      const organization = await Organization.findById(
        user.organizationId
      ).select('status');

      if (!organization || organization.status !== 'ACTIVE') {
        return res.status(403).json({
          message: 'Your organization is inactive. Please contact the System Administrator.'
        });
      }
    }

    let permissions = [];
    let position = null;

    if (user.roleId) {
      position = await Position.findById(user.roleId);
      permissions = position ? position.permissions : [];
    }

    req.user = user;
    req.position = position;
    req.permissions = permissions;

    // Tenant scoping.
    req.organizationId = user.organizationId
      ? String(user.organizationId)
      : null;

    req.isSystemAdmin = user.systemRole === 'SYSTEM_ADMIN';

    next();

  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
