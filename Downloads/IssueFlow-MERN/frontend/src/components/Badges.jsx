import React from 'react';

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

export function SlaIndicator({ deadline, status }) {
  if (['RESOLVED', 'CANCELLED'].includes(status)) return <span className="small muted">—</span>;
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diffMs = dl - now;
  const breached = diffMs < 0;
  const hours = Math.abs(diffMs) / 3600000;
  const label = hours < 1 ? `${Math.round(Math.abs(diffMs) / 60000)}m` : `${hours.toFixed(1)}h`;
  return (
    <span className={`badge ${breached ? 'badge-CRITICAL' : hours < 4 ? 'badge-HIGH' : 'badge-MEDIUM'}`}>
      {breached ? `Overdue ${label}` : `${label} left`}
    </span>
  );
}
