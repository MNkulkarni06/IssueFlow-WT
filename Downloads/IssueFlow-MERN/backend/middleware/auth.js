const jwt = require('jsonwebtoken');
const { User, Position } = require('../models');

// Verifies the JWT, loads the current user (with organization + position),
// and attaches them to req. This is the single source of truth for identity —
// the frontend can never assert who it is.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.';
      return res.status(401).json({ message });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Account not found or inactive.' });
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
    // Tenant scoping: every downstream query for organization-owned data
    // MUST use req.organizationId, never a client-supplied value.
    req.organizationId = user.organizationId ? String(user.organizationId) : null;
    req.isSystemAdmin = user.systemRole === 'SYSTEM_ADMIN';

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
