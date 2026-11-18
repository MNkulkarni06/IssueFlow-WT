
const { User, Position, Organization } = require('../models');
const { signToken } = require('../utils/token');

// Validate registration details
function validateUserInput({ name, email, password, phone }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u.test(cleanName)) {
    return 'Name must be 2-80 characters and contain only letters.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Please enter a valid email address.';
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.';
  }

  if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return 'Please enter a valid 10-digit Indian mobile number.';
  }

  return null;
}

// Public self-registration is limited to END-USER positions.
async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      phone,
      organizationId,
      roleId,
      departmentId
    } = req.body;

    if (!name || !email || !password || !organizationId || !roleId) {
      return res.status(400).json({
        message: 'Name, email, password, organization and position are required.'
      });
    }

    const validationError = validateUserInput({
      name,
      email,
      password,
      phone
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Check whether the organization exists and is active.
    const organization = await Organization.findById(organizationId);

    if (!organization || organization.status !== 'ACTIVE') {
      return res.status(403).json({
        message: 'This organization is inactive. Registration is not allowed.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      organizationId,
      email: cleanEmail
    });

    if (existing) {
      return res.status(409).json({
        message: 'An account with this email already exists in this organization.'
      });
    }

    const position = await Position.findOne({
      _id: roleId,
      organizationId,
      isEndUserRole: true,
      status: 'ACTIVE'
    });

    if (!position) {
      return res.status(400).json({
        message: 'Invalid self-registration role for this organization.'
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      phone: phone ? phone.trim() : '',
      organizationId,
      roleId,
      departmentId: departmentId || null
    });

    const token = signToken(user);

    res.status(201).json({
      token,
      user: sanitize(user)
    });

  } catch (err) {
    next(err);
  }
}

// Login
async function login(req, res, next) {
  try {
    const { email, password, organizationId } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({
        message: 'Please enter a valid email address.'
      });
    }

    const query = {
      email: String(email).trim().toLowerCase()
    };

    if (organizationId) {
      query.organizationId = organizationId;
    }

    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials.'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        message: 'Account is inactive. Please contact your administrator.'
      });
    }

    // Prevent login to an inactive organization.
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

    // Do not apply new password-strength rules to existing login passwords.
    const ok = await user.comparePassword(password);

    if (!ok) {
      return res.status(401).json({
        message: 'Invalid credentials.'
      });
    }

    const token = signToken(user);

    res.json({
      token,
      user: sanitize(user)
    });

  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.json({
    message: 'Logged out.'
  });
}

async function me(req, res) {
  res.json({
    user: sanitize(req.user),
    permissions: req.permissions,
    position: req.position
  });
}

function sanitize(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
}

module.exports = {
  register,
  login,
  logout,
  me
};
