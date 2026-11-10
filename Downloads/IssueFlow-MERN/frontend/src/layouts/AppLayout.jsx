import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSocket } from '../services/socket.js';
import api from '../services/api.js';
import './layout.css';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', perm: null },
  { to: '/complaints', label: 'Complaints', perm: null },
  { to: '/complaints/create', label: 'New Complaint', perm: 'CREATE_COMPLAINT' },
  { to: '/notifications', label: 'Notifications', perm: null },
];

const ADMIN_NAV = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/departments', label: 'Departments' },
  { to: '/admin/roles', label: 'Positions' },
  { to: '/admin/hierarchy', label: 'Hierarchy' },
  { to: '/admin/categories', label: 'Categories & SLA' },
  { to: '/admin/analytics', label: 'Analytics' },
];

export default function AppLayout() {
  const { user, position, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function loadUnread() {
      try {
        const { data } = await api.get('/notifications');
        setUnread(data.unreadCount || 0);
      } catch (e) { /* ignore */ }
    }
    loadUnread();
    const socket = getSocket();
    if (socket) {
      const bump = () => setUnread((u) => u + 1);
      socket.on('NOTIFICATION', bump);
      return () => socket.off('NOTIFICATION', bump);
    }
  }, []);

  const isOrgAdmin = hasPermission('MANAGE_ORGANIZATION');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IF</div>
          <div>
            <div className="brand-name">IssueFlow</div>
            <div className="brand-sub">{position ? position.name : 'System Admin'}</div>
          </div>
        </div>

        <nav className="nav-group">
          <div className="nav-label">Workspace</div>
          {NAV.filter((n) => !n.perm || hasPermission(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {n.label}
              {n.to === '/notifications' && unread > 0 && <span className="nav-badge">{unread}</span>}
            </NavLink>
          ))}
        </nav>

        {isOrgAdmin && (
          <nav className="nav-group">
            <div className="nav-label">Organization Admin</div>
            {ADMIN_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}

        {user.systemRole === 'SYSTEM_ADMIN' && (
          <nav className="nav-group">
            <div className="nav-label">Platform</div>
            <NavLink to="/system-admin/organizations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Organizations</NavLink>
            <NavLink to="/system-admin/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Platform Analytics</NavLink>
          </nav>
        )}

        <div className="sidebar-footer">
          <div className="user-chip" onClick={() => navigate('/profile')} role="button" tabIndex={0}>
            <div className="avatar">{user.name.charAt(0)}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-email small muted">{user.email}</div>
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
        </div>
      </aside>

      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
