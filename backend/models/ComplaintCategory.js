const mongoose = require('mongoose');

const complaintCategorySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    // Optional: complaints in this category are routed through this department's chain
    defaultDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    slaHours: { type: Number, required: true, default: 48 }, // default SLA for complaints in this category
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

complaintCategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ComplaintCategory', complaintCategorySchema);
