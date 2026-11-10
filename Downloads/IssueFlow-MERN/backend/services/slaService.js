// Computes SLA deadlines. Never hard-code hours anywhere else in the app —
// always go through here so the source of truth (category / hierarchy level
// config) stays authoritative.

function hoursFromNow(hours, from = new Date()) {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

// Initial SLA when a complaint is created: prefers the SLA configured on the
// FIRST hierarchy level (if set), else falls back to the category's SLA.
function computeInitialDeadline({ categorySlaHours, firstLevelSlaHours }) {
  const hours = firstLevelSlaHours != null ? firstLevelSlaHours : categorySlaHours;
  return hoursFromNow(hours);
}

// SLA for the next level after escalation: prefers that level's own SLA,
// else falls back to the category default.
function computeEscalatedDeadline({ categorySlaHours, nextLevelSlaHours }) {
  const hours = nextLevelSlaHours != null ? nextLevelSlaHours : categorySlaHours;
  return hoursFromNow(hours);
}

function isApproachingDeadline(complaint, warningPercent, warningMinutesRemaining, createdAt) {
  const now = Date.now();
  const deadline = new Date(complaint.slaDeadline).getTime();
  if (now >= deadline) return false; // already expired, handled by escalation job
  if (warningMinutesRemaining != null) {
    return deadline - now <= warningMinutesRemaining * 60 * 1000;
  }
  const total = deadline - new Date(createdAt).getTime();
  if (total <= 0) return true;
  const consumed = now - new Date(createdAt).getTime();
  return consumed / total >= (warningPercent || 80) / 100;
}

module.exports = { hoursFromNow, computeInitialDeadline, computeEscalatedDeadline, isApproachingDeadline };
