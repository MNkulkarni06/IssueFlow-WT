const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true }, // null only for SYSTEM_ADMIN
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, default: '' },
    // System-level flag, separate from organization Position.
    systemRole: { type: String, enum: ['NONE', 'SYSTEM_ADMIN'], default: 'NONE' },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null }, // organization Position
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    organizationalUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationalUnit', default: null },
    designation: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

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
