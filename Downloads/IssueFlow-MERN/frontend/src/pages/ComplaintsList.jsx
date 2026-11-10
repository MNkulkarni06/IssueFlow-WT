import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { StatusBadge, PriorityBadge, SlaIndicator } from '../components/Badges.jsx';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'];

export default function ComplaintsList() {
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '', slaStatus: '' });

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/complaints', { params })
      .then(({ data }) => {
        setComplaints(data.complaints);
        setTotal(data.total);
        setPages(data.pages);
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  const setFilter = (key) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaints</h1>
          <p className="page-sub">{total} total</p>
        </div>
      </div>

      <div className="filter-bar">
        <input placeholder="Search title or description…" value={filters.search} onChange={setFilter('search')} style={{ minWidth: 220 }} />
        <select value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.category} onChange={setFilter('category')}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={filters.priority} onChange={setFilter('priority')}>
          <option value="">All priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.slaStatus} onChange={setFilter('slaStatus')}>
          <option value="">Any SLA status</option>
          <option value="breached">Breached</option>
          <option value="ontrack">On track</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner" />
        ) : complaints.length === 0 ? (
          <div className="empty-state">No complaints match these filters.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Title</th><th>Category</th><th>Assignee</th><th>Level</th><th>Status</th><th>Priority</th><th>SLA</th></tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c._id}>
                    <td><Link to={`/complaints/${c._id}`}>{c.title}</Link></td>
                    <td className="muted small">{c.categoryId?.name}</td>
                    <td className="muted small">{c.currentAssignee?.name || '—'}</td>
                    <td className="muted small">Level {c.currentHierarchyOrder}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td><SlaIndicator deadline={c.slaDeadline} status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', alignItems: 'center' }}>
              <span className="small muted">Page {page} of {pages}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
