const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Informational only — core logic must never branch on this value.
    type: {
      type: String,
      enum: ['BANK', 'SCHOOL', 'COLLEGE', 'UNIVERSITY', 'COMPANY', 'HOSPITAL', 'GOVERNMENT', 'NGO', 'OTHER'],
      default: 'OTHER',
    },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    address: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    // Free-form, organization-controlled settings (SLA warning threshold, etc.)
    settings: {
      slaWarningPercent: { type: Number, default: 80 }, // notify when 80% of SLA consumed
      slaWarningMinutesRemaining: { type: Number, default: null },
      usesOrganizationalUnits: { type: Boolean, default: false }, // branches/regions optional
      setupComplete: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
