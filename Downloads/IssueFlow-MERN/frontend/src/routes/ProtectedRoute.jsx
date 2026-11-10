import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, permission, systemAdminOnly, orgAdminOnly }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (systemAdminOnly && user.systemRole !== 'SYSTEM_ADMIN') return <Navigate to="/dashboard" replace />;
  if (orgAdminOnly && !hasPermission('MANAGE_ORGANIZATION')) return <Navigate to="/dashboard" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;

  return children;
}
