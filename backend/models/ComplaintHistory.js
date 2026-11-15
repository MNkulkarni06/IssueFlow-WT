const mongoose = require('mongoose');

const complaintHistorySchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = system (cron)
    action: { type: String, required: true },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, default: null },
    previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    newAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousLevel: { type: Number, default: null },
    newLevel: { type: Number, default: null },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

complaintHistorySchema.index({ complaintId: 1, timestamp: 1 });

module.exports = mongoose.model('ComplaintHistory', complaintHistorySchema);
