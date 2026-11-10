const mongoose = require('mongoose');

// A "Position" is an organization-defined role label (e.g. "Branch Manager",
// "Teacher", "Team Lead"). It is completely configurable per organization and
// is what a User's roleId points to. Application PERMISSIONS (see
// utils/permissions.js) are attached to a Position by the org admin.
const positionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "Branch Manager"
    description: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    permissions: [{ type: String }], // subset of PERMISSIONS
    isEndUserRole: { type: Boolean, default: false }, // e.g. Customer/Student/Employee submitting complaints
    isOrgAdmin: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

positionSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);
