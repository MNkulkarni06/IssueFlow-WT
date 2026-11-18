
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Name must contain at least 2 characters.'],
      maxlength: [80, 'Name cannot exceed 80 characters.'],
      match: [
        /^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u,
        'Please enter a valid name.'
      ]
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email cannot exceed 254 characters.'],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address.'
      ]
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    phone: {
      type: String,
      default: '',
      validate: {
        validator: function(value) {
          return !value || /^[6-9]\d{9}$/.test(value);
        },
        message: 'Please enter a valid 10-digit Indian mobile number.'
      }
    },

    // System-level flag, separate from organization Position.
    systemRole: {
      type: String,
      enum: ['NONE', 'SYSTEM_ADMIN'],
      default: 'NONE'
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },

    organizationalUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrganizationalUnit',
      default: null
    },

    designation: {
      type: String,
      default: ''
    },

    employeeId: {
      type: String,
      default: ''
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
);

// Unique email within each organization.
userSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true }
);

// Hash password before saving.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// Compare entered password with hashed password.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isOrgAdmin = async function isOrgAdmin() {
  if (!this.roleId) return false;

  const Position = mongoose.model('Position');
  const pos = await Position.findById(this.roleId);

  return !!(pos && pos.isOrgAdmin);
};

module.exports = mongoose.model('User', userSchema);
