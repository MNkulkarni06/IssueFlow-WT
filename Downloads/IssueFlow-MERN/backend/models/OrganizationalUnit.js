const mongoose = require('mongoose');

// Optional hierarchy of physical/organizational units, e.g. Region -> Branch,
// or Office locations. Entirely optional — organizations that don't need
// branches simply never create any of these.
const organizationalUnitSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, default: 'UNIT' }, // e.g. REGION, BRANCH, OFFICE, WING - free text, informational
    parentUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationalUnit', default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

organizationalUnitSchema.index({ organizationId: 1, parentUnitId: 1 });

module.exports = mongoose.model('OrganizationalUnit', organizationalUnitSchema);
