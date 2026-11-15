import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api, { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [organizations, setOrganizations] = useState([]);
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', organizationId: '', roleId: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/organizations/public/list').then(({ data }) => setOrganizations(data.organizations));
  }, []);

  useEffect(() => {
    if (!form.organizationId) {
      setPositions([]);
      return;
    }
    api
      .get('/positions/public/end-user-roles', { params: { organizationId: form.organizationId } })
      .then(({ data }) => setPositions(data.positions));
  }, [form.organizationId]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split-auth">
      <div className="split-auth-brand">
        <div className="brand-mark" style={{ background: 'rgba(255,255,255,0.15)' }}>IF</div>
        <h1 style={{ color: '#fff', fontSize: '2.2rem' }}>Create your account</h1>
        <p style={{ opacity: 0.85, maxWidth: 420 }}>
          Pick your organization below — the available role (Customer, Student,
          Employee, and so on) is entirely defined by how that organization has
          configured itself.
        </p>
      </div>
      <div className="split-auth-panel">
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Register</h2>
          <form onSubmit={submit}>
            <div className="field">
              <label>Organization</label>
              <select required value={form.organizationId} onChange={update('organizationId')}>
                <option value="">Select organization…</option>
                {organizations.map((o) => (
                  <option key={o._id} value={o._id}>{o.name} ({o.type})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Your role</label>
              <select required value={form.roleId} onChange={update('roleId')} disabled={!form.organizationId}>
                <option value="">Select role…</option>
                {positions.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Full name</label>
              <input required value={form.name} onChange={update('name')} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={update('email')} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={update('phone')} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={update('password')} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="small" style={{ marginTop: '1rem' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
