import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const TYPES = ['BANK', 'SCHOOL', 'COLLEGE', 'UNIVERSITY', 'COMPANY', 'HOSPITAL', 'GOVERNMENT', 'NGO', 'OTHER'];

export default function SystemOrganizations() {
  const toast = useToast();
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'OTHER', description: '' });
  const [adminForms, setAdminForms] = useState({});

  const load = () => api.get('/organizations').then(({ data }) => setOrgs(data.organizations));
  useEffect(() => { load(); }, []);

  const createOrg = async (e) => {
    e.preventDefault();
    try {
      await api.post('/organizations', form);
      setForm({ name: '', type: 'OTHER', description: '' });
      load();
      toast.push('Organization created. Now bootstrap its first admin below.', 'success');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const toggleStatus = async (org) => {
    await api.patch(`/organizations/${org._id}`, { status: org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    load();
  };

  const createAdmin = async (orgId) => {
    const data = adminForms[orgId] || {};
    try {
      await api.post(`/organizations/${orgId}/admin`, data);
      toast.push('Organization admin created.', 'success');
      setAdminForms((f) => ({ ...f, [orgId]: { name: '', email: '', password: '' } }));
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const updateAdminForm = (orgId, field, value) => setAdminForms((f) => ({ ...f, [orgId]: { ...(f[orgId] || {}), [field]: value } }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-sub">Platform-wide. Each organization configures its own departments, roles, hierarchy, categories and SLAs independently.</p>
        </div>
      </div>

      <form onSubmit={createOrg} className="card grid grid-3" style={{ marginBottom: '1.5rem', alignItems: 'end' }}>
        <div className="field"><label>Organization name</label><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="field">
          <label>Type (informational only)</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><button type="submit" className="btn-primary" style={{ width: '100%' }}>Create organization</button></div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orgs.map((org) => (
          <div className="card" key={org._id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{org.name}</div>
                <div className="small muted">{org.type} · created {new Date(org.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge ${org.status === 'ACTIVE' ? 'badge-RESOLVED' : 'badge-CANCELLED'}`}>{org.status}</span>
                <button className="btn-sm" onClick={() => toggleStatus(org)}>{org.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Bootstrap organization admin</summary>
              <div className="grid grid-3" style={{ marginTop: '0.75rem' }}>
                <input placeholder="Name" value={adminForms[org._id]?.name || ''} onChange={(e) => updateAdminForm(org._id, 'name', e.target.value)} />
                <input placeholder="Email" value={adminForms[org._id]?.email || ''} onChange={(e) => updateAdminForm(org._id, 'email', e.target.value)} />
                <input placeholder="Temporary password" value={adminForms[org._id]?.password || ''} onChange={(e) => updateAdminForm(org._id, 'password', e.target.value)} />
              </div>
              <button className="btn-sm btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => createAdmin(org._id)}>Create admin account</button>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
