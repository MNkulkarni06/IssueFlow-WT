
const { User, Position } = require('../models');
const { logAudit } = require('../services/auditService');

// Resolves organization scope.
function scopedOrgId(req) {
  if (req.isSystemAdmin) {
    return req.query.organizationId || req.body.organizationId || null;
  }

  return req.organizationId;
}

// Validate user details.
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

async function listUsers(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: 'organizationId is required.'
      });
    }

    const users = await User.find({ organizationId })
      .populate('roleId departmentId')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);

    const user = await User.findOne({
      _id: req.params.id,
      organizationId
    }).populate('roleId departmentId');

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: 'organizationId is required.'
      });
    }

    const {
      name,
      email,
      password,
      phone,
      roleId,
      departmentId,
      organizationalUnitId,
      designation,
      employeeId
    } = req.body;

    if (!name || !email || !password || !roleId) {
      return res.status(400).json({
        message: 'Name, email, password and position are required.'
      });
    }

    const validationError = validateUserInput({
      name,
      email,
      password,
      phone
    });

    if (validationError) {
      return res.status(400).json({
        message: validationError
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const position = await Position.findOne({
      _id: roleId,
      organizationId
    });

    if (!position) {
      return res.status(400).json({
        message: 'roleId does not belong to this organization.'
      });
    }

    const existing = await User.findOne({
      organizationId,
      email: cleanEmail
    });

    if (existing) {
      return res.status(409).json({
        message: 'A user with this email already exists in this organization.'
      });
    }

    const user = await User.create({
      organizationId,
      name: name.trim(),
      email: cleanEmail,
      password,
      phone: phone ? phone.trim() : '',
      roleId,
      departmentId: departmentId || null,
      organizationalUnitId: organizationalUnitId || null,
      designation,
      employeeId
    });

    await logAudit({
      organizationId,
      performedBy: req.user._id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: user._id,
      details: {
        email: user.email,
        roleId
      }
    });

    const clean = user.toObject();
    delete clean.password;

    res.status(201).json({ user: clean });

  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);

    const allowed = [
      'name',
      'phone',
      'roleId',
      'departmentId',
      'organizationalUnitId',
      'designation',
      'employeeId'
    ];

    const update = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    // Validate updated name.
    if (update.name !== undefined) {
      const cleanName = String(update.name).trim();

      if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u.test(cleanName)) {
        return res.status(400).json({
          message: 'Name must be 2-80 characters and contain only letters.'
        });
      }

      update.name = cleanName;
    }

    // Validate updated phone number.
    if (update.phone !== undefined) {
      const cleanPhone = String(update.phone).trim();

      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          message: 'Please enter a valid 10-digit Indian mobile number.'
        });
      }

      update.phone = cleanPhone;
    }

    if (update.roleId) {
      const position = await Position.findOne({
        _id: update.roleId,
        organizationId
      });

      if (!position) {
        return res.status(400).json({
          message: 'roleId does not belong to this organization.'
        });
      }
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        organizationId
      },
      {
        $set: update
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (update.roleId) {
      await logAudit({
        organizationId,
        performedBy: req.user._id,
        action: 'USER_ROLE_CHANGED',
        targetType: 'User',
        targetId: user._id,
        details: {
          newRoleId: update.roleId
        }
      });
    }

    res.json({ user });

  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const organizationId = scopedOrgId(req);
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status.'
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        organizationId
      },
      {
        $set: { status }
      },
      {
        new: true
      }
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    res.json({ user });

  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateStatus
};
