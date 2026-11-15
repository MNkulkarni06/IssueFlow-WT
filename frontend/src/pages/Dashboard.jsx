import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, PriorityBadge, SlaIndicator } from '../components/Badges.jsx';

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/complaints', { params: { limit: 50 } })
      .then(({ data }) => setComplaints(data.complaints))
      .finally(() => setLoading(false));
  }, []);

  const counts = complaints.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const slaWarnings = complaints.filter(
    (c) => !['RESOLVED', 'CANCELLED'].includes(c.status) && new Date(c.slaDeadline).getTime() - Date.now() < 4 * 3600000
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="page-sub">Here's what needs your attention today.</p>
        </div>
        {hasPermission('CREATE_COMPLAINT') && (
          <Link to="/complaints/create"><button className="btn-primary">+ New complaint</button></Link>
        )}
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.75rem' }}>
        <div className="card stat-card"><div className="stat-value">{counts.OPEN || 0}</div><div className="stat-label">Open</div></div>
        <div className="card stat-card"><div className="stat-value">{counts.IN_PROGRESS || 0}</div><div className="stat-label">In progress</div></div>
        <div className="card stat-card"><div className="stat-value">{counts.ESCALATED || 0}</div><div className="stat-label">Escalated</div></div>
        <div className="card stat-card"><div className="stat-value">{counts.RESOLVED || 0}</div><div className="stat-label">Resolved</div></div>
      </div>

      {slaWarnings.length > 0 && (
        <div className="card" style={{ marginBottom: '1.75rem', borderColor: 'var(--accent)' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>SLA warnings ({slaWarnings.length})</h3>
          {slaWarnings.slice(0, 5).map((c) => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
              <Link to={`/complaints/${c._id}`}>{c.title}</Link>
              <SlaIndicator deadline={c.slaDeadline} status={c.status} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Your complaints</h3>
        {loading ? (
          <div className="spinner" />
        ) : complaints.length === 0 ? (
          <div className="empty-state">No complaints yet. Nothing to show — you're all caught up.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Title</th><th>Category</th><th>Status</th><th>Priority</th><th>SLA</th></tr>
            </thead>
            <tbody>
              {complaints.slice(0, 10).map((c) => (
                <tr key={c._id}>
                  <td><Link to={`/complaints/${c._id}`}>{c.title}</Link></td>
                  <td className="muted small">{c.categoryId?.name}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><PriorityBadge priority={c.priority} /></td>
                  <td><SlaIndicator deadline={c.slaDeadline} status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {complaints.length > 10 && (
          <div style={{ marginTop: '0.75rem' }}><Link to="/complaints">View all complaints →</Link></div>
        )}
      </div>
    </div>
  );
}
