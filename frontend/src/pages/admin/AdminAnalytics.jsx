import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import api from '../../services/api.js';

const COLORS = ['#1f4b43', '#c65d3b', '#2b6cb0', '#b8860b', '#b23b3b', '#2f7a4d'];

export default function AdminAnalytics() {
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [escalations, setEscalations] = useState(null);

  useEffect(() => {
    api.get('/analytics/organization').then(({ data }) => setOverview(data));
    api.get('/analytics/complaints').then(({ data }) => setBreakdown(data));
    api.get('/analytics/escalations').then(({ data }) => setEscalations(data));
  }, []);

  if (!overview || !breakdown || !escalations) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">How complaints are flowing through your configured hierarchy.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.75rem' }}>
        <div className="card stat-card"><div className="stat-value">{overview.total}</div><div className="stat-label">Total complaints</div></div>
        <div className="card stat-card"><div className="stat-value">{overview.slaBreached}</div><div className="stat-label">SLA breaches</div></div>
        <div className="card stat-card"><div className="stat-value">{overview.avgResolutionHours}h</div><div className="stat-label">Avg. resolution time</div></div>
        <div className="card stat-card"><div className="stat-value">{overview.escalationRate}%</div><div className="stat-label">Escalation rate</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Complaints by status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Open', value: overview.open },
                  { name: 'In progress', value: overview.inProgress },
                  { name: 'Escalated', value: overview.escalated },
                  { name: 'Resolved', value: overview.resolved },
                  { name: 'Cancelled', value: overview.cancelled },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Complaints by category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdown.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1f4b43" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Complaints by hierarchy level</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdown.byLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="level" tickFormatter={(v) => `Level ${v}`} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#c65d3b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Complaints by department</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdown.byDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2b6cb0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Escalations</h3>
        <div className="grid grid-3">
          <div className="stat-card"><div className="stat-value">{escalations.totalEscalated}</div><div className="stat-label">Complaints escalated at least once</div></div>
          <div className="stat-card"><div className="stat-value">{escalations.avgEscalationCount}</div><div className="stat-label">Average escalations per complaint</div></div>
          <div className="stat-card"><div className="stat-value">{escalations.maxEscalationReached}</div><div className="stat-label">Hit maximum escalation (need admin action)</div></div>
        </div>
      </div>
    </div>
  );
}
