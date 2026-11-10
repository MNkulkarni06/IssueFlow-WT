import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminPositions() {
  const toast = useToast();
  const [positions, setPositions] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', departmentId: '', permissions: [], isEndUserRole: false, isOrgAdmin: false });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api.get('/positions').then(({ data }) => { setPositions(data.positions); setAvailablePermissions(data.availablePermissions); });
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
  };
  useEffect(() => { load(); }, []);

  const togglePerm = (p) => setForm((f) => ({
    ...f,
    permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
  }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/positions', form);
      toast.push('Position created.', 'success');
      setForm({ name: '', description: '', departmentId: '', permissions: [], isEndUserRole: false, isOrgAdmin: false });
      setShowForm(false);
      load();
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Positions</h1>
          <p className="page-sub">Organization-specific roles (e.g. Branch Manager, Teacher, Team Lead) with their own permission set — separate from the escalation hierarchy itself.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New position'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="grid grid-2">
            <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="field">
              <label>Department (optional)</label>
              <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                <option value="">None</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Description</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.isEndUserRole} onChange={(e) => setForm((f) => ({ ...f, isEndUserRole: e.target.checked }))} />
              This is an end-user role (e.g. Customer, Student, Employee) that can self-register and submit complaints
            </label>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.isOrgAdmin} onChange={(e) => setForm((f) => ({ ...f, isOrgAdmin: e.target.checked }))} />
              This is an Organization Admin role (full control over this organization)
            </label>
          </div>
          <div className="field">
            <label>Permissions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {availablePermissions.map((p) => (
                <button type="button" key={p} className="btn-sm" style={form.permissions.includes(p) ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : {}} onClick={() => togglePerm(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '0.75rem' }}>Create position</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Department</th><th>Type</th><th>Permissions</th></tr></thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td className="small muted">{p.departmentId?.name || '—'}</td>
                <td className="small muted">{p.isOrgAdmin ? 'Org Admin' : p.isEndUserRole ? 'End user' : 'Authority'}</td>
                <td className="small muted">{p.permissions.length} permission{p.permissions.length !== 1 ? 's' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
