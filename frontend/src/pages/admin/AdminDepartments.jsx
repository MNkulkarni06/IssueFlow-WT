import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminDepartments() {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => api.get('/departments').then(({ data }) => setDepartments(data.departments));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', form);
      setForm({ name: '', description: '' });
      load();
      toast.push('Department created.', 'success');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const remove = async (id) => {
    await api.delete(`/departments/${id}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-sub">Units within your organization (e.g. Loans, Science, Engineering).</p>
        </div>
      </div>

      <form onSubmit={submit} className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="field" style={{ flex: 2, minWidth: 220, marginBottom: 0 }}>
          <label>Description</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <button type="submit" className="btn-primary">Add department</button>
      </form>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Status</th><th /></tr></thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d._id}>
                <td>{d.name}</td>
                <td className="small muted">{d.description}</td>
                <td><span className={`badge ${d.status === 'ACTIVE' ? 'badge-RESOLVED' : 'badge-CANCELLED'}`}>{d.status}</span></td>
                <td><button className="btn-sm btn-ghost" onClick={() => remove(d._id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
