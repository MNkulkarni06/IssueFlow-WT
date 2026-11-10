import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminHierarchy() {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [scopeDepartmentId, setScopeDepartmentId] = useState('');
  const [levels, setLevels] = useState([]);
  const [form, setForm] = useState({ label: '', positionId: '', slaHours: '' });

  const load = () => {
    api.get('/departments').then(({ data }) => setDepartments(data.departments));
    api.get('/positions').then(({ data }) => setPositions(data.positions));
  };
  useEffect(() => { load(); }, []);

  const loadLevels = () => {
    api.get('/hierarchy', { params: { departmentId: scopeDepartmentId || undefined } }).then(({ data }) => setLevels(data.levels));
  };
  useEffect(() => { loadLevels(); }, [scopeDepartmentId]);

  const addLevel = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hierarchy', { ...form, scopeDepartmentId: scopeDepartmentId || null, slaHours: form.slaHours ? Number(form.slaHours) : null });
      setForm({ label: '', positionId: '', slaHours: '' });
      loadLevels();
      toast.push('Level added.', 'success');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    }
  };

  const move = async (index, direction) => {
    const newOrder = [...levels];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setLevels(newOrder);
    await api.patch('/hierarchy/reorder', { scopeDepartmentId: scopeDepartmentId || null, orderedIds: newOrder.map((l) => l._id) });
    loadLevels();
  };

  const deactivate = async (id) => {
    await api.delete(`/hierarchy/${id}`);
    loadLevels();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Escalation hierarchy</h1>
          <p className="page-sub">Define the ordered chain of authorities a complaint escalates through. Change it freely — no code changes required.</p>
        </div>
      </div>

      <div className="field" style={{ maxWidth: 320, marginBottom: '1.5rem' }}>
        <label>Chain scope</label>
        <select value={scopeDepartmentId} onChange={(e) => setScopeDepartmentId(e.target.value)}>
          <option value="">Organization default (all departments)</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name} — dedicated chain</option>)}
        </select>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Current chain</h3>
          {levels.length === 0 ? (
            <div className="empty-state">No levels configured yet for this scope.</div>
          ) : (
            <div className="hierarchy-chain">
              {levels.map((l, idx) => (
                <React.Fragment key={l._id}>
                  <div className="hierarchy-node">
                    <div>{l.label}</div>
                    <div className="small muted">{l.positionId?.name}</div>
                    {l.slaHours && <div className="small muted">SLA override: {l.slaHours}h</div>}
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                      <button className="btn-sm btn-ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                      <button className="btn-sm btn-ghost" onClick={() => move(idx, 1)} disabled={idx === levels.length - 1}>↓</button>
                      <button className="btn-sm btn-ghost" onClick={() => deactivate(l._id)}>Remove</button>
                    </div>
                  </div>
                  {idx < levels.length - 1 && <div className="hierarchy-arrow">↓</div>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={addLevel} className="card">
          <h3 style={{ marginBottom: '1rem' }}>Add a level</h3>
          <div className="field">
            <label>Label</label>
            <input required placeholder="e.g. Level 2: Regional Manager" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="field">
            <label>Authority (position)</label>
            <select required value={form.positionId} onChange={(e) => setForm((f) => ({ ...f, positionId: e.target.value }))}>
              <option value="">Select position…</option>
              {positions.filter((p) => !p.isEndUserRole).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>SLA override for this level (hours, optional)</label>
            <input type="number" min="1" value={form.slaHours} onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))} placeholder="Falls back to category SLA" />
          </div>
          <button type="submit" className="btn-primary">Add level to chain</button>
        </form>
      </div>
    </div>
  );
}
