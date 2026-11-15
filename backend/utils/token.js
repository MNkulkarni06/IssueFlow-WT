const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { userId: user._id, organizationId: user.organizationId, systemRole: user.systemRole },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { signToken };
