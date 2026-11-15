import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StatusBadge, PriorityBadge, SlaIndicator } from '../components/Badges.jsx';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [remark, setRemark] = useState('');
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: h }] = await Promise.all([
      api.get(`/complaints/${id}`),
      api.get(`/complaints/${id}/history`),
    ]);
    setComplaint(c.complaint);
    setHistory(h.history);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, payload) => {
    setBusy(true);
    try {
      await action(payload);
      await load();
      toast.push('Done.', 'success');
    } catch (err) {
      toast.push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!complaint) return <div className="spinner" />;

  const isAssignee = complaint.currentAssignee && complaint.currentAssignee._id === user._id;
  const isAdmin = hasPermission('MANAGE_ORGANIZATION');
  const isSubmitter = complaint.submittedBy && complaint.submittedBy._id === user._id;
  const canAct = isAssignee || isAdmin;
  const terminal = ['RESOLVED', 'CANCELLED'].includes(complaint.status);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{complaint.title}</h1>
          <p className="page-sub">Submitted by {complaint.submittedBy?.name} on {new Date(complaint.createdAt).toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Description</h3>
            <p>{complaint.description}</p>
            {complaint.attachments?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div className="small muted" style={{ marginBottom: '0.3rem' }}>Attachments</div>
                {complaint.attachments.map((a) => (
                  <div key={a.filename}><a href={`${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${a.path}`} target="_blank" rel="noreferrer">{a.originalName}</a></div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Timeline</h3>
            <div className="timeline">
              {history.map((h) => (
                <div className="timeline-item" key={h._id}>
                  <div style={{ fontWeight: 600 }}>{h.action}</div>
                  <div className="small muted">
                    {h.performedBy ? h.performedBy.name : 'System (automatic)'} · {new Date(h.timestamp).toLocaleString()}
                  </div>
                  {h.reason && <div className="small" style={{ marginTop: '0.2rem' }}>{h.reason}</div>}
                  {h.previousLevel !== h.newLevel && h.newLevel != null && (
                    <div className="small muted">Level {h.previousLevel ?? '—'} → Level {h.newLevel}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Assignment</h3>
            <div className="small muted">Current authority</div>
            <div style={{ marginBottom: '0.6rem', fontWeight: 600 }}>{complaint.currentAssignee?.name || 'Unassigned'}</div>
            <div className="small muted">Position / Level</div>
            <div style={{ marginBottom: '0.6rem' }}>{complaint.currentPositionId?.name} (Level {complaint.currentHierarchyOrder})</div>
            <div className="small muted">Escalation count</div>
            <div>{complaint.escalationCount}</div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>SLA</h3>
            <div className="small muted">Deadline</div>
            <div style={{ marginBottom: '0.6rem' }}>{new Date(complaint.slaDeadline).toLocaleString()}</div>
            <SlaIndicator deadline={complaint.slaDeadline} status={complaint.status} />
            {complaint.maxEscalationReached && (
              <p className="small" style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>
                Maximum escalation reached — needs admin intervention.
              </p>
            )}
          </div>

          {!terminal && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {canAct && complaint.status !== 'IN_PROGRESS' && (
                  <button disabled={busy} onClick={() => act(() => api.patch(`/complaints/${id}/acknowledge`))}>Acknowledge</button>
                )}
                {canAct && complaint.status !== 'IN_PROGRESS' && (
                  <button disabled={busy} onClick={() => act(() => api.patch(`/complaints/${id}/start`))}>Start work</button>
                )}
                {canAct && (
                  <button disabled={busy || !hasPermission('MANUAL_ESCALATE') && !isAdmin} onClick={() => act(() => api.post(`/complaints/${id}/escalate`, { reason: 'Manually escalated from complaint detail.' }))}>
                    Escalate to next level
                  </button>
                )}
                {(isSubmitter || isAdmin) && (
                  <button className="btn-danger" disabled={busy} onClick={() => act(() => api.patch(`/complaints/${id}/cancel`, { reason: 'Cancelled by user.' }))}>Cancel complaint</button>
                )}
                {canAct && (
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.4rem' }}>Resolve</summary>
                    <textarea placeholder="Resolution remarks" value={resolutionRemarks} onChange={(e) => setResolutionRemarks(e.target.value)} />
                    <button style={{ marginTop: '0.4rem' }} className="btn-primary" disabled={busy} onClick={() => act(() => api.patch(`/complaints/${id}/resolve`, { resolutionRemarks }))}>
                      Mark resolved
                    </button>
                  </details>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Add a remark</h3>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Add a note visible in the timeline" />
            <button style={{ marginTop: '0.5rem' }} disabled={busy || !remark} onClick={() => act(() => api.post(`/complaints/${id}/remarks`, { remark }).then(() => setRemark('')))}>
              Add remark
            </button>
          </div>

          {(isAdmin || (canAct && hasPermission('MANUAL_ESCALATE'))) && !terminal && (
            <div className="card" style={{ borderColor: 'var(--accent)' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Demo: force automatic escalation</h3>
              <p className="small muted" style={{ marginBottom: '0.6rem' }}>
                Development only. Sets the SLA deadline to 1 minute from now so the
                backend cron worker escalates it automatically — no code changes,
                no waiting days.
              </p>
              <button disabled={busy} onClick={() => act(() => api.post(`/complaints/${id}/dev-set-deadline`, { minutesFromNow: 1 }))}>
                Expire SLA in 1 minute
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
