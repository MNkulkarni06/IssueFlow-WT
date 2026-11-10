const mongoose = require('mongoose');

// This is the CORE model that makes escalation generic. A hierarchy is an
// ordered chain of levels for an organization. Optionally a chain can be
// scoped to a single department (scopeDepartmentId); if a complaint's
// department has no dedicated chain, the organization's default chain
// (scopeDepartmentId = null) is used instead.
//
// Escalation logic NEVER hardcodes a position name — it only ever asks:
// "what HierarchyLevel comes after this one, for this organization
// (and department)?"
const hierarchyLevelSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    scopeDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    order: { type: Number, required: true }, // 1, 2, 3 ... defines the chain order
    label: { type: String, required: true }, // display label e.g. "Level 1"
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
    slaHours: { type: Number, default: null }, // optional per-level SLA override (hours)
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

hierarchyLevelSchema.index({ organizationId: 1, scopeDepartmentId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('HierarchyLevel', hierarchyLevelSchema);
