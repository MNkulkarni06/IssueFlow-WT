const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplaintCategory', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    organizationalUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationalUnit', default: null },

    // Which hierarchy chain this complaint is following, and where it is now.
    hierarchyScopeDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    currentHierarchyOrder: { type: Number, required: true }, // matches HierarchyLevel.order
    currentAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentPositionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null },

    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'],
      default: 'OPEN',
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },

    slaDeadline: { type: Date, required: true },
    slaWarningSent: { type: Boolean, default: false },
    escalationCount: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date, default: null },
    maxEscalationReached: { type: Boolean, default: false },

    resolvedAt: { type: Date, default: null },
    resolutionRemarks: { type: String, default: '' },
    attachments: [
      {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        path: String,
      },
    ],
  },
  { timestamps: true }
);

complaintSchema.index({ organizationId: 1, status: 1, slaDeadline: 1, currentHierarchyOrder: 1 });
complaintSchema.index({ organizationId: 1, submittedBy: 1 });
complaintSchema.index({ organizationId: 1, currentAssignee: 1 });
complaintSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Complaint', complaintSchema);
