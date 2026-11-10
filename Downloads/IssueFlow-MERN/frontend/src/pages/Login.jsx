import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Demo@123');
  };

  return (
    <div className="split-auth">
      <div className="split-auth-brand">
        <div className="brand-mark" style={{ background: 'rgba(255,255,255,0.15)' }}>IF</div>
        <h1 style={{ color: '#fff', fontSize: '2.2rem' }}>One platform. Any organization.</h1>
        <p style={{ opacity: 0.85, maxWidth: 420 }}>
          IssueFlow lets a bank, a school, a hospital, or any company configure its own
          departments, roles, escalation hierarchy, and SLAs — the same engine, driven
          entirely by configuration, not code.
        </p>
      </div>
      <div className="split-auth-panel">
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ marginBottom: '0.3rem' }}>Sign in</h2>
          <p className="muted small" style={{ marginBottom: '1.25rem' }}>Log in to your organization's workspace.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.demo" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
            <p className="small muted" style={{ marginBottom: '0.5rem' }}>Quick demo logins (password Demo@123):</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button type="button" className="btn-sm" onClick={() => fillDemo('bank.admin@issueflow.demo')}>Bank Admin</button>
              <button type="button" className="btn-sm" onClick={() => fillDemo('school.admin@issueflow.demo')}>School Admin</button>
              <button type="button" className="btn-sm" onClick={() => fillDemo('company.admin@issueflow.demo')}>Company Admin</button>
              <button type="button" className="btn-sm" onClick={() => fillDemo('sysadmin@issueflow.demo')}>System Admin</button>
            </div>
          </div>

          <p className="small" style={{ marginTop: '1rem' }}>
            New organization? <Link to="/register">Register a complaint account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
