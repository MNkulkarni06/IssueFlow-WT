import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ComplaintCreate() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', categoryId: '', departmentId: '', priority: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories));
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      files.forEach((f) => fd.append('attachments', f));
      const { data } = await api.post('/complaints', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.push('Complaint submitted.', 'success');
      navigate(`/complaints/${data.complaint._id}`);
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Submit a complaint</h1>
          <p className="page-sub">It will be routed automatically to the first authority in your organization's configured hierarchy.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Title</label>
          <input required value={form.title} onChange={update('title')} placeholder="Short summary of the issue" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea required value={form.description} onChange={update('description')} placeholder="Describe the issue in detail" />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Category</label>
            <select required value={form.categoryId} onChange={update('categoryId')}>
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name} (SLA {c.slaHours}h)</option>)}
            </select>
          </div>
          <div className="field">
            <label>Department (optional)</label>
            <select value={form.departmentId} onChange={update('departmentId')}>
              <option value="">Not specified</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Priority (optional — defaults to category priority)</label>
          <select value={form.priority} onChange={update('priority')}>
            <option value="">Use category default</option>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Attachments (optional)</label>
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
      </form>
    </div>
  );
}
