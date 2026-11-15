const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'COMPLAINT_CREATED',
        'COMPLAINT_ASSIGNED',
        'COMPLAINT_ACKNOWLEDGED',
        'COMPLAINT_STARTED',
        'COMPLAINT_ESCALATED',
        'COMPLAINT_RESOLVED',
        'COMPLAINT_CANCELLED',
        'SLA_WARNING',
        'SLA_EXPIRED',
        'MAX_ESCALATION_REACHED',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
