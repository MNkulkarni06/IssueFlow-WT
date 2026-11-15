import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminCategories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', priority: 'MEDIUM', slaHours: 24, defaultDepartmentId: '' });

  const load = () => {
    api.get('/categories').then(({ data }) => setCategories(data.categories));
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', form);
      setForm({ name: '', description: '', priority: 'MEDIUM', slaHours: 24, defaultDepartmentId: '' });
      load();
      toast.push('Category created.', 'success');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const updateSla = async (id, slaHours) => {
    await api.patch(`/categories/${id}`, { slaHours: Number(slaHours) });
    load();
  };

  const deactivate = async (id) => {
    await api.delete(`/categories/${id}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaint categories &amp; SLA</h1>
          <p className="page-sub">Each category carries its own default SLA. Deadlines are always computed as createdAt + configured SLA — never hard-coded.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card" style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'end' }}>
        <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="field">
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Routes to department</label>
          <select value={form.defaultDepartmentId} onChange={(e) => setForm((f) => ({ ...f, defaultDepartmentId: e.target.value }))}>
            <option value="">Use complainant's choice</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field"><label>SLA (hours)</label><input type="number" min="1" required value={form.slaHours} onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))} /></div>
        <div><button type="submit" className="btn-primary" style={{ width: '100%' }}>Add category</button></div>
      </form>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Priority</th><th>Routes to department</th><th>SLA (hours)</th><th /></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td><span className={`badge badge-${c.priority}`}>{c.priority}</span></td>
                <td>
                  <select
                    value={c.defaultDepartmentId?._id || ''}
                    onChange={async (e) => { await api.patch(`/categories/${c._id}`, { defaultDepartmentId: e.target.value || null }); load(); }}
                  >
                    <option value="">Use complainant's choice</option>
                    {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min="1" defaultValue={c.slaHours} style={{ width: 90 }} onBlur={(e) => e.target.value != c.slaHours && updateSla(c._id, e.target.value)} />
                </td>
                <td><button className="btn-sm btn-ghost" onClick={() => deactivate(c._id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
