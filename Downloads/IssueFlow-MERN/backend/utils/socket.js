let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

// Rooms are per-user so a user only ever receives events addressed to them.
// Users join `user:<userId>` on connection (see server.js).
function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

module.exports = { setIO, getIO, emitToUser };
