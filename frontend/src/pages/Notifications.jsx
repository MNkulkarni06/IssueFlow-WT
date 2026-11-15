import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/notifications').then(({ data }) => setNotifications(data.notifications)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const markAll = async () => {
    await api.patch('/notifications/read-all');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Real-time updates on complaints you're involved in.</p>
        </div>
        <button className="btn-sm" onClick={markAll}>Mark all as read</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner" />
        ) : notifications.length === 0 ? (
          <div className="empty-state">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--line)', opacity: n.read ? 0.6 : 1 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div className="small muted">{n.message}</div>
                <div className="small muted">{new Date(n.createdAt).toLocaleString()}</div>
                {n.complaintId && <Link className="small" to={`/complaints/${n.complaintId}`}>View complaint →</Link>}
              </div>
              {!n.read && <button className="btn-sm btn-ghost" onClick={() => markRead(n._id)}>Mark read</button>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
