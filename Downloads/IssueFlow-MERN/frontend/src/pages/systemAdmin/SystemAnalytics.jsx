import React, { useEffect, useState } from 'react';
import api from '../../services/api.js';

export default function SystemAnalytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/organizations/stats/system').then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform analytics</h1>
          <p className="page-sub">Aggregate numbers across every organization on IssueFlow. No organization's individual complaints are exposed here.</p>
        </div>
      </div>
      <div className="grid grid-4">
        <div className="card stat-card"><div className="stat-value">{stats.totalOrganizations}</div><div className="stat-label">Organizations</div></div>
        <div className="card stat-card"><div className="stat-value">{stats.activeOrganizations}</div><div className="stat-label">Active organizations</div></div>
        <div className="card stat-card"><div className="stat-value">{stats.totalUsers}</div><div className="stat-label">Total users</div></div>
        <div className="card stat-card"><div className="stat-value">{stats.totalComplaints}</div><div className="stat-label">Total complaints</div></div>
        <div className="card stat-card"><div className="stat-value">{stats.totalEscalations}</div><div className="stat-label">Complaints escalated at least once</div></div>
        <div className="card stat-card"><div className="stat-value">{stats.resolutionRate}%</div><div className="stat-label">Platform-wide resolution rate</div></div>
      </div>
    </div>
  );
}
