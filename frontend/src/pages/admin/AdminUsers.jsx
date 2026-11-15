import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '', departmentId: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api.get('/users').then(({ data }) => setUsers(data.users));
    api.get('/positions').then(({ data }) => setPositions(data.positions));
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
  };

  useEffect(() => { load(); }, []);

  const update = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      toast.push('User created.', 'success');
      setForm({ name: '', email: '', password: '', roleId: '', departmentId: '' });
      setShowForm(false);
      load();
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const toggleStatus = async (u) => {
    await api.patch(`/users/${u._id}/status`, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Everyone in your organization, with their configured position.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ Add user'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="field"><label>Name</label><input required value={form.name} onChange={update('name')} /></div>
          <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={update('email')} /></div>
          <div className="field"><label>Temporary password</label><input type="password" required minLength={6} value={form.password} onChange={update('password')} /></div>
          <div className="field">
            <label>Position</label>
            <select required value={form.roleId} onChange={update('roleId')}>
              <option value="">Select…</option>
              {positions.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Department</label>
            <select value={form.departmentId} onChange={update('departmentId')}>
              <option value="">None</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'end' }}><button type="submit" className="btn-primary">Create user</button></div>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Department</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td className="small muted">{u.email}</td>
                <td>{u.roleId?.name || '—'}</td>
                <td className="small muted">{u.departmentId?.name || '—'}</td>
                <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-RESOLVED' : 'badge-CANCELLED'}`}>{u.status}</span></td>
                <td><button className="btn-sm btn-ghost" onClick={() => toggleStatus(u)}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
