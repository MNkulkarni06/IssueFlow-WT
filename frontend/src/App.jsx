import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ComplaintsList from './pages/ComplaintsList.jsx';
import ComplaintCreate from './pages/ComplaintCreate.jsx';
import ComplaintDetail from './pages/ComplaintDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';

import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminDepartments from './pages/admin/AdminDepartments.jsx';
import AdminPositions from './pages/admin/AdminPositions.jsx';
import AdminHierarchy from './pages/admin/AdminHierarchy.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';

import SystemOrganizations from './pages/systemAdmin/SystemOrganizations.jsx';
import SystemAnalytics from './pages/systemAdmin/SystemAnalytics.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/complaints" element={<ComplaintsList />} />
        <Route path="/complaints/create" element={<ProtectedRoute permission="CREATE_COMPLAINT"><ComplaintCreate /></ProtectedRoute>} />
        <Route path="/complaints/:id" element={<ComplaintDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/admin/users" element={<ProtectedRoute orgAdminOnly><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute orgAdminOnly><AdminDepartments /></ProtectedRoute>} />
        <Route path="/admin/roles" element={<ProtectedRoute orgAdminOnly><AdminPositions /></ProtectedRoute>} />
        <Route path="/admin/hierarchy" element={<ProtectedRoute orgAdminOnly><AdminHierarchy /></ProtectedRoute>} />
        <Route path="/admin/categories" element={<ProtectedRoute orgAdminOnly><AdminCategories /></ProtectedRoute>} />
        <Route path="/admin/sla" element={<Navigate to="/admin/categories" replace />} />
        <Route path="/admin/analytics" element={<ProtectedRoute orgAdminOnly><AdminAnalytics /></ProtectedRoute>} />

        <Route path="/system-admin/organizations" element={<ProtectedRoute systemAdminOnly><SystemOrganizations /></ProtectedRoute>} />
        <Route path="/system-admin/analytics" element={<ProtectedRoute systemAdminOnly><SystemAnalytics /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
