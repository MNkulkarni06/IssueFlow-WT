const { User, Position } = require('../models');
const { signToken } = require('../utils/token');

// Public self-registration is intentionally limited to END-USER style
// positions within an existing organization (e.g. Customer/Student/Employee).
// Administrative users are created by the Organization Admin via
// /api/users, and organizations themselves via /api/organizations.
async function register(req, res, next) {
  try {
    const { name, email, password, phone, organizationId, roleId, departmentId } = req.body;
    if (!name || !email || !password || !organizationId || !roleId) {
      return res.status(400).json({ message: 'name, email, password, organizationId and roleId are required.' });
    }

    const existing = await User.findOne({ organizationId, email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists in this organization.' });
    }

    const position = await Position.findOne({ _id: roleId, organizationId, isEndUserRole: true, status: 'ACTIVE' });
    if (!position) {
      return res.status(400).json({ message: 'Invalid self-registration role for this organization.' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      organizationId,
      roleId,
      departmentId: departmentId || null,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password, organizationId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const query = { email: email.toLowerCase() };
    if (organizationId) query.organizationId = organizationId;

    const user = await User.findOne(query).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ message: 'Account is inactive.' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // Stateless JWT: logout is a client-side token discard. Endpoint kept for
  // API completeness / future token-blacklisting.
  res.json({ message: 'Logged out.' });
}

async function me(req, res) {
  res.json({ user: sanitize(req.user), permissions: req.permissions, position: req.position });
}

function sanitize(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
}

module.exports = { register, login, logout, me };
