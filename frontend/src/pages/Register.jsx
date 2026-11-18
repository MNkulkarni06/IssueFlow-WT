
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

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    organizationId: '',
    roleId: ''
  });

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/organizations/public/list')
      .then(({ data }) => setOrganizations(data.organizations))
      .catch((err) => toast.push(errorMessage(err), 'error'));
  }, []);

  useEffect(() => {
    if (!form.organizationId) {
      setPositions([]);
      return;
    }

    api
      .get('/positions/public/end-user-roles', {
        params: { organizationId: form.organizationId }
      })
      .then(({ data }) => setPositions(data.positions))
      .catch((err) => toast.push(errorMessage(err), 'error'));
  }, [form.organizationId]);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (busy) return;

    setBusy(true);

    try {
      await register({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim()
      });

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
        <div
          className="brand-mark"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          IF
        </div>

        <h1 style={{ color: '#fff', fontSize: '2.2rem' }}>
          Create your account
        </h1>

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
              <select
                required
                value={form.organizationId}
                onChange={update('organizationId')}
              >
                <option value="">Select organization…</option>

                {organizations.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name} ({o.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Your role</label>
              <select
                required
                value={form.roleId}
                onChange={update('roleId')}
                disabled={!form.organizationId}
              >
                <option value="">Select role…</option>

                {positions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Full name</label>
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
              <label>Phone (10-digit Indian mobile number)</label>
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
              <label>Password</label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,128}"
                title="Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
                value={form.password}
                onChange={update('password')}
              />
              <small className="muted">
                Use at least 8 characters with uppercase, lowercase, number
                and special character.
              </small>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={busy}
            >
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
