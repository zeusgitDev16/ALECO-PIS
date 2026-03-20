import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../utils/api';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/Buttons.css';
import '../CSS/InterruptionsAdmin.css';

const emptyForm = {
  type: 'Unscheduled',
  status: 'Pending',
  affectedAreasText: '',
  feeder: '',
  cause: '',
  dateTimeStart: '',
  dateTimeEndEstimated: '',
  dateTimeRestored: '',
};

function displayToDatetimeLocal(s) {
  if (!s) return '';
  return String(s).replace(' ', 'T').slice(0, 16);
}

function datetimeLocalToApi(s) {
  if (!s || !String(s).trim()) return null;
  return String(s).replace('T', ' ');
}

const AdminInterruptions = () => {
  const [interruptions, setInterruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/interruptions?limit=200'));
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInterruptions(data.data);
      } else {
        setInterruptions([]);
      }
    } catch {
      setInterruptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage(null);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      type: row.type,
      status: row.status,
      affectedAreasText: (row.affectedAreas || []).join(', '),
      feeder: row.feeder || '',
      cause: row.cause || '',
      dateTimeStart: displayToDatetimeLocal(row.dateTimeStart),
      dateTimeEndEstimated: displayToDatetimeLocal(row.dateTimeEndEstimated),
      dateTimeRestored: displayToDatetimeLocal(row.dateTimeRestored),
    });
    setShowForm(true);
    setMessage(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const affectedAreas = form.affectedAreasText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      type: form.type,
      status: form.status,
      affectedAreas,
      feeder: form.feeder,
      cause: form.cause,
      dateTimeStart: datetimeLocalToApi(form.dateTimeStart),
      dateTimeEndEstimated: datetimeLocalToApi(form.dateTimeEndEstimated),
      dateTimeRestored: datetimeLocalToApi(form.dateTimeRestored),
    };

    try {
      const url = editingId
        ? apiUrl(`/api/interruptions/${editingId}`)
        : apiUrl('/api/interruptions');
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMessage({ type: 'err', text: data.message || 'Save failed.' });
        return;
      }
      setMessage({ type: 'ok', text: editingId ? 'Updated.' : 'Created.' });
      closeForm();
      await fetchList();
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interruption advisory?')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/interruptions/${id}`), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMessage({ type: 'err', text: data.message || 'Delete failed.' });
        return;
      }
      setMessage({ type: 'ok', text: 'Deleted.' });
      await fetchList();
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout activePage="interruptions">
      <div className="admin-page-container">
        <div className="dashboard-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">Power Interruptions</h2>
            <p className="header-subtitle">
              Manage scheduled and unscheduled advisories (stored in <code>aleco_interruptions</code>).
            </p>
          </div>
          <button type="button" className="btn-add-purple" onClick={openCreate} disabled={saving}>
            + New advisory
          </button>
        </div>

        {message && (
          <p
            className="widget-text interruptions-admin-msg"
            data-variant={message.type}
            role="status"
          >
            {message.text}
          </p>
        )}

        {showForm && (
          <div className="main-content-card interruptions-admin-form-card">
            <h3 className="header-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
              {editingId ? `Edit #${editingId}` : 'New interruption'}
            </h3>
            <form className="interruptions-admin-form" onSubmit={handleSubmit}>
              <label>
                Type
                <select
                  value={form.type}
                  onChange={(ev) => setForm((f) => ({ ...f, type: ev.target.value }))}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Unscheduled">Unscheduled</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))}
                >
                  <option value="Pending">Pending</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Restored">Restored</option>
                </select>
              </label>
              <label className="interruptions-admin-span2">
                Affected areas (comma-separated)
                <input
                  type="text"
                  value={form.affectedAreasText}
                  onChange={(ev) => setForm((f) => ({ ...f, affectedAreasText: ev.target.value }))}
                  placeholder="Legazpi City, Daraga"
                />
              </label>
              <label>
                Feeder
                <input
                  type="text"
                  value={form.feeder}
                  onChange={(ev) => setForm((f) => ({ ...f, feeder: ev.target.value }))}
                  required
                />
              </label>
              <label>
                Cause
                <input
                  type="text"
                  value={form.cause}
                  onChange={(ev) => setForm((f) => ({ ...f, cause: ev.target.value }))}
                  required
                />
              </label>
              <label>
                Start
                <input
                  type="datetime-local"
                  value={form.dateTimeStart}
                  onChange={(ev) => setForm((f) => ({ ...f, dateTimeStart: ev.target.value }))}
                  required
                />
              </label>
              <label>
                Est. end
                <input
                  type="datetime-local"
                  value={form.dateTimeEndEstimated}
                  onChange={(ev) => setForm((f) => ({ ...f, dateTimeEndEstimated: ev.target.value }))}
                />
              </label>
              <label>
                Restored
                <input
                  type="datetime-local"
                  value={form.dateTimeRestored}
                  onChange={(ev) => setForm((f) => ({ ...f, dateTimeRestored: ev.target.value }))}
                />
              </label>
              <div className="interruptions-admin-actions">
                <button type="submit" className="btn-add-purple" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </button>
                <button type="button" className="nav-btn" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="main-content-card">
          {loading ? (
            <p className="widget-text">Loading…</p>
          ) : interruptions.length === 0 ? (
            <div className="placeholder-content">
              <h3>No advisories</h3>
              <p className="widget-text">Create one with &quot;New advisory&quot; or they will appear here from the API.</p>
            </div>
          ) : (
            <table className="interruptions-admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Feeder</th>
                  <th>Areas</th>
                  <th>Start</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {interruptions.map((i) => (
                  <tr key={i.id}>
                    <td>{i.id}</td>
                    <td>{i.status}</td>
                    <td>{i.type}</td>
                    <td>{i.feeder}</td>
                    <td className="interruptions-admin-areas">{(i.affectedAreas || []).join(', ')}</td>
                    <td>{i.dateTimeStart}</td>
                    <td className="interruptions-admin-row-actions">
                      <button type="button" className="nav-btn" onClick={() => openEdit(i)} disabled={saving}>
                        Edit
                      </button>
                      <button type="button" className="nav-btn" onClick={() => handleDelete(i.id)} disabled={saving}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminInterruptions;
