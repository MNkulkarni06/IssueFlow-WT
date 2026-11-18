
import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminUsers() {
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
    departmentId: ''
  });

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get('/users').then(({ data }) => setUsers(data.users));
    api.get('/positions').then(({ data }) => setPositions(data.positions));
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => {
    setForm((state) => ({
      ...state,
      [field]: e.target.value
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (busy) return;

    setBusy(true);

    try {
      await api.post('/users', {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim()
      });

      toast.push('User created successfully.', 'success');

      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        roleId: '',
        departmentId: ''
      });

      setShowForm(false);
      load();

    } catch (err) {
      toast.push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (u) => {
    try {
      await api.patch(`/users/${u._id}/status`, {
        status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      });

      toast.push('User status updated.', 'success');
      load();

    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">
            Everyone in your organization, with their configured position.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowForm((state) => !state)}
        >
          {showForm ? 'Cancel' : '+ Add user'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="card grid grid-2"
          style={{ marginBottom: '1.5rem' }}
        >
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              pattern="[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}"
              title="Enter a valid name between 2 and 80 characters."
              value={form.name}
              onChange={update('name')}
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              maxLength={254}
              value={form.email}
              onChange={update('email')}
            />
          </div>

          <div className="field">
            <label>Temporary password</label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,128}"
              title="Use at least 8 characters with uppercase, lowercase, number and special character."
              value={form.password}
              onChange={update('password')}
            />
            <small className="muted">
              Must contain uppercase, lowercase, number and special character.
            </small>
          </div>

          <div className="field">
            <label>Mobile number</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              title="Enter a valid 10-digit Indian mobile number."
              value={form.phone}
              onChange={update('phone')}
            />
          </div>

          <div className="field">
            <label>Position</label>
            <select
              required
              value={form.roleId}
              onChange={update('roleId')}
            >
              <option value="">Select…</option>
              {positions.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Department</label>
            <select
              value={form.departmentId}
              onChange={update('departmentId')}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: 'end' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Position</th>
              <th>Department</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td className="small muted">{u.email}</td>
                <td>{u.roleId?.name || '—'}</td>
                <td className="small muted">
                  {u.departmentId?.name || '—'}
                </td>
                <td>
                  <span
                    className={`badge ${
                      u.status === 'ACTIVE'
                        ? 'badge-RESOLVED'
                        : 'badge-CANCELLED'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td>
                  <button
                    className="btn-sm btn-ghost"
                    onClick={() => toggleStatus(u)}
                  >
                    {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
