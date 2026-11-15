const { Notification } = require('../models');
const { emitToUser } = require('../utils/socket');

async function notify({ organizationId, userId, type, title, message, complaintId = null }) {
  if (!userId) return null;
  const notification = await Notification.create({ organizationId, userId, type, title, message, complaintId });
  emitToUser(userId, type, {
    notificationId: notification._id,
    title,
    message,
    complaintId,
    createdAt: notification.createdAt,
  });
  emitToUser(userId, 'NOTIFICATION', notification);
  return notification;
}

async function notifyMany(recipients, payload) {
  const unique = [...new Set(recipients.filter(Boolean).map(String))];
  return Promise.all(unique.map((userId) => notify({ ...payload, userId })));
}

module.exports = { notify, notifyMany };
