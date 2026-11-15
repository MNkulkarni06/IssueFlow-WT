import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, position, permissions } = useAuth();
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Your account details.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="field"><label>Name</label><p>{user.name}</p></div>
        <div className="field"><label>Email</label><p>{user.email}</p></div>
        {user.phone && <div className="field"><label>Phone</label><p>{user.phone}</p></div>}
        <div className="field"><label>Position</label><p>{position ? position.name : (user.systemRole === 'SYSTEM_ADMIN' ? 'System Administrator' : '—')}</p></div>
        {permissions.length > 0 && (
          <div className="field">
            <label>Permissions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {permissions.map((p) => <span key={p} className="badge badge-MEDIUM">{p}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
