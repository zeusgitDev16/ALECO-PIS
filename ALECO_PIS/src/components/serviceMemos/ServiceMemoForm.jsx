import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import {
  fetchTicketPreviewForMemo,
  createServiceMemo,
  updateServiceMemo,
  listServiceMemos,
} from '../../api/serviceMemosApi';
import ServiceMemoTopStrip from './ServiceMemoTopStrip';

function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function nowTimeStr() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const emptyForm = () => ({
  ticket_id: '',
  received_by: '',
  intake_date: todayDateStr(),
  intake_time: nowTimeStr(),
  referred_to: '',
  referral_received_date: todayDateStr(),
  referral_received_time: nowTimeStr(),
  action_taken: '',
  site_arrived_date: '',
  site_arrived_time: '',
  finished_date: todayDateStr(),
  finished_time: nowTimeStr(),
  internal_notes: '',
  resolution_details: '',
});

const emptyStrip = () => ({
  account_number: '',
  customer_name: '',
  address: '',
  control_number: '',
  ticket_query: '',
  memo_query: '',
  ticket_id: '',
});

/**
 * Single reference layout for create | update | view.
 * @param {'create'|'update'|'view'} mode
 */
const ServiceMemoForm = ({
  mode,
  memo,
  onBack,
  onSaved,
  onMemoNavigate,
  currentUserEmail,
  currentUserName,
}) => {
  const readOnly = mode === 'view';
  const stripVariant = mode === 'create' ? 'input' : mode === 'update' ? 'search' : 'display';

  const [ticketPreview, setTicketPreview] = useState(null);
  const [stripValues, setStripValues] = useState(emptyStrip);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const displayTicket = useMemo(() => {
    if (mode === 'create' && ticketPreview) return ticketPreview;
    if (memo && memo.ticket_id) return memo;
    return null;
  }, [mode, ticketPreview, memo]);

  const syncStripFromTicket = useCallback((t) => {
    if (!t) return;
    const name = [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    setStripValues((prev) => ({
      ...prev,
      account_number: t.account_number ?? prev.account_number ?? '',
      customer_name: name || prev.customer_name || '',
      address: t.address ?? prev.address ?? '',
      ticket_query: t.ticket_id ?? prev.ticket_query ?? '',
      ticket_id: t.ticket_id ?? prev.ticket_id ?? '',
    }));
  }, []);

  const syncStripFromMemo = useCallback((m) => {
    if (!m) return;
    const name = m.requested_by || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ').trim();
    setStripValues({
      account_number: m.account_number ?? '',
      customer_name: name || '',
      address: m.location || m.address || '',
      control_number: m.control_number || '',
      ticket_query: m.ticket_id || '',
      memo_query: '',
      ticket_id: m.ticket_id || '',
    });
  }, []);

  useEffect(() => {
    if (mode === 'view' && memo) {
      syncStripFromMemo(memo);
      setPhotoUrl(memo.photo_url || null);
    }
    if (mode === 'update' && memo) {
      syncStripFromMemo(memo);
      setPhotoUrl(memo.photo_url || null);
    }
  }, [memo, mode, syncStripFromMemo]);

  useEffect(() => {
    if (mode === 'create') {
      setStripValues(emptyStrip());
      setTicketPreview(null);
      setPhotoUrl(null);
      setPhotoFile(null);
    }
  }, [mode]);

  useEffect(() => {
    if (!memo || mode === 'create') return;
    setForm({
      ticket_id: memo.ticket_id || '',
      received_by: memo.received_by || '',
      intake_date: memo.intake_date || memo.service_date || todayDateStr(),
      intake_time: memo.intake_time || nowTimeStr(),
      referred_to: memo.referred_to || '',
      referral_received_date: memo.referral_received_date || todayDateStr(),
      referral_received_time: memo.referral_received_time || nowTimeStr(),
      action_taken: memo.action_taken || memo.work_performed || '',
      site_arrived_date: memo.site_arrived_date || '',
      site_arrived_time: memo.site_arrived_time || '',
      finished_date: memo.finished_date || todayDateStr(),
      finished_time: memo.finished_time || nowTimeStr(),
      internal_notes: memo.internal_notes || '',
      resolution_details: memo.resolution_details || '',
    });
  }, [memo, mode]);

  const handleField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStripChange = (key, value) => {
    setStripValues((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoChange = (dataUrl, file) => {
    setPhotoUrl(dataUrl);
    setPhotoFile(file);
  };

  const handlePhotoRemove = () => {
    setPhotoUrl(null);
    setPhotoFile(null);
  };

  const handleLoadTicket = async () => {
    setLoadError(null);
    const q = stripValues.ticket_query?.trim() || '';
    const r = await fetchTicketPreviewForMemo(q);
    if (!r.ok || !r.ticket) {
      setTicketPreview(null);
      setLoadError(r.message || 'Ticket not found.');
      return;
    }
    setTicketPreview(r.ticket);
    syncStripFromTicket(r.ticket);
    setForm((f) => ({
      ...f,
      ticket_id: r.ticket.ticket_id,
      received_by: f.received_by || currentUserName || '',
    }));
  };

  const handleSearchTicketNavigate = async () => {
    if (!onMemoNavigate || mode !== 'update') return;
    const q = stripValues.ticket_query?.trim() || '';
    if (!q) return;
    setSearchBusy(true);
    setLoadError(null);
    try {
      const r = await fetchTicketPreviewForMemo(q);
      if (!r.ok || !r.ticket) {
        setLoadError(r.message || 'Ticket not found.');
        return;
      }
      const list = await listServiceMemos({ tab: 'all', search: r.ticket.ticket_id });
      if (!list.success || !list.data?.length) {
        setLoadError('No service memo found for that ticket.');
        return;
      }
      const row = list.data.find((m) => m.ticket_id === r.ticket.ticket_id) || list.data[0];
      if (row?.id) {
        if (row.id === memo?.id) {
          setLoadError('Already viewing this memo.');
          return;
        }
        onMemoNavigate(row.id);
      }
    } finally {
      setSearchBusy(false);
    }
  };

  const handleSearchMemoNavigate = async () => {
    if (!onMemoNavigate || mode !== 'update') return;
    const q = stripValues.memo_query?.trim() || stripValues.control_number?.trim() || '';
    if (!q) return;
    setSearchBusy(true);
    setLoadError(null);
    try {
      const list = await listServiceMemos({ tab: 'all', search: q });
      if (!list.success || !list.data?.length) {
        setLoadError('No memo matching that search.');
        return;
      }
      const exact = list.data.find((m) => (m.control_number || '').toLowerCase() === q.toLowerCase());
      const row = exact || list.data[0];
      if (row?.id) {
        if (row.id === memo?.id) {
          setLoadError('Already viewing this memo.');
          return;
        }
        onMemoNavigate(row.id);
      }
    } finally {
      setSearchBusy(false);
    }
  };

  const handleStripListSearch = async (field) => {
    if (!onMemoNavigate || mode !== 'update') return;
    const term = stripValues[field]?.trim();
    if (!term) return;
    setSearchBusy(true);
    setLoadError(null);
    try {
      const list = await listServiceMemos({ tab: 'all', search: term });
      if (!list.success || !list.data?.length) {
        setLoadError('No memo matching that search.');
        return;
      }
      const row = list.data[0];
      if (row?.id) {
        if (row.id === memo?.id) {
          setLoadError('Already viewing this memo.');
          return;
        }
        onMemoNavigate(row.id);
      }
    } finally {
      setSearchBusy(false);
    }
  };

  const handleStripSearchField = async (field) => {
    if (mode !== 'update') return;
    if (field === 'memo_query') {
      await handleSearchMemoNavigate();
      return;
    }
    if (field === 'ticket_query') {
      await handleSearchTicketNavigate();
      return;
    }
    await handleStripListSearch(field);
  };

  const buildPayload = () => {
    const base = {
      ticket_id: displayTicket?.ticket_id || form.ticket_id,
      received_by: form.received_by.trim(),
      intake_date: form.intake_date,
      intake_time: form.intake_time,
      referred_to: form.referred_to.trim(),
      referral_received_date: form.referral_received_date,
      referral_received_time: form.referral_received_time,
      action_taken: form.action_taken.trim(),
      work_performed: form.action_taken.trim(),
      finished_date: form.finished_date,
      finished_time: form.finished_time,
      site_arrived_date: form.site_arrived_date.trim() || null,
      site_arrived_time: form.site_arrived_time.trim() || null,
      internal_notes: form.internal_notes.trim(),
      resolution_details: form.resolution_details.trim() || undefined,
      service_date: form.intake_date,
    };
    return base;
  };

  const handleSave = async () => {
    setSaveError(null);
    if (mode === 'create' && !ticketPreview) {
      setSaveError('Load a valid closed ticket before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        const r = await createServiceMemo(payload);
        if (!r.success) {
          setSaveError(r.message || 'Could not create memo.');
          return;
        }
        onSaved?.(r.data);
      } else if (mode === 'update' && memo?.id) {
        const r = await updateServiceMemo(memo.id, {
          ...payload,
          memo_status: memo.memo_status === 'draft' ? 'saved' : undefined,
        });
        if (!r.success) {
          setSaveError(r.message || 'Could not save.');
          return;
        }
        onSaved?.(memo);
      }
    } finally {
      setSaving(false);
    }
  };

  const fullName = displayTicket
    ? [displayTicket.first_name, displayTicket.middle_name, displayTicket.last_name].filter(Boolean).join(' ').trim()
    : stripValues.customer_name || '—';

  const stripPropsValues = useMemo(() => {
    if (mode === 'view' && memo) {
      return {
        account_number: memo.account_number ?? '',
        customer_name: memo.requested_by || fullName,
        address: memo.location || memo.address || '',
        control_number: memo.control_number || '',
        ticket_id: memo.ticket_id || '',
      };
    }
    if (mode === 'create') {
      return {
        ...stripValues,
        control_number: '',
        ticket_id: ticketPreview?.ticket_id || '',
      };
    }
    if (mode === 'update' && memo) {
      return {
        ...stripValues,
        account_number: stripValues.account_number || memo.account_number || '',
        customer_name: stripValues.customer_name || memo.requested_by || fullName,
        address: stripValues.address || memo.location || memo.address || '',
        control_number: memo.control_number || '',
        ticket_id: memo.ticket_id || '',
      };
    }
    return stripValues;
  }, [mode, memo, stripValues, ticketPreview, fullName]);

  const stripProps = {
    variant: stripVariant,
    values: stripPropsValues,
    onChange: handleStripChange,
    onLoadTicket: handleLoadTicket,
    onSearchField: mode === 'update' ? handleStripSearchField : undefined,
    loadError,
    searchBusy,
    disabled: readOnly,
    photoUrl,
    onPhotoChange: handlePhotoChange,
    onPhotoRemove: handlePhotoRemove,
  };

  const renderFormGrid = () => (
    <div className="service-memo-form-grid">
        <section className="service-memo-form-section service-memo-band service-memo-band--request">
          <h4 className="service-memo-band-heading">Request / ticket</h4>
          <div className="service-memo-form-row">
            <label>Ticket ID</label>
            <input type="text" readOnly value={displayTicket?.ticket_id ?? ''} />
          </div>
          <div className="service-memo-form-row">
            <label>Status</label>
            <input
              type="text"
              readOnly
              value={memo?.ticket_live_status || displayTicket?.ticket_live_status || displayTicket?.status || memo?.ticket_status || ''}
            />
          </div>
          <div className="service-memo-form-row">
            <label>Requested by</label>
            <input type="text" readOnly value={memo?.requested_by || fullName} />
          </div>
          <div className="service-memo-form-row">
            <label>Location</label>
            <input
              type="text"
              readOnly
              value={
                memo?.location || [displayTicket?.address, displayTicket?.municipality].filter(Boolean).join(', ') || ''
              }
            />
          </div>
          <div className="service-memo-form-row">
            <label>Contact no.</label>
            <input type="text" readOnly value={memo?.contact_no || displayTicket?.phone_number || ''} />
          </div>
          <div className="service-memo-form-row">
            <label>Action desired</label>
            <textarea readOnly value={memo?.action_desired || displayTicket?.action_desired || ''} rows={2} />
          </div>
        </section>

        <section className="service-memo-form-section service-memo-band service-memo-band--intake">
          <h4 className="service-memo-band-heading">Intake</h4>
          <div className="service-memo-form-row">
            <label htmlFor="received_by">Received by</label>
            <input
              id="received_by"
              name="received_by"
              value={form.received_by}
              onChange={handleField}
              disabled={readOnly}
              placeholder={currentUserName || 'Dispatcher name'}
            />
          </div>
          <div className="service-memo-form-row two-col">
            <div>
              <label htmlFor="intake_date">Date received</label>
              <input id="intake_date" name="intake_date" type="date" value={form.intake_date} onChange={handleField} disabled={readOnly} />
            </div>
            <div>
              <label htmlFor="intake_time">Time received</label>
              <input id="intake_time" name="intake_time" type="time" value={form.intake_time} onChange={handleField} disabled={readOnly} />
            </div>
          </div>
        </section>

        <section className="service-memo-form-section service-memo-band service-memo-band--resolution">
          <h4 className="service-memo-band-heading">Referral and action</h4>
          <div className="service-memo-form-row">
            <label htmlFor="referred_to">Referred to</label>
            <input id="referred_to" name="referred_to" value={form.referred_to} onChange={handleField} disabled={readOnly} />
          </div>
          <div className="service-memo-form-row two-col">
            <div>
              <label htmlFor="referral_received_date">Referral received date</label>
              <input
                id="referral_received_date"
                name="referral_received_date"
                type="date"
                value={form.referral_received_date}
                onChange={handleField}
                disabled={readOnly}
              />
            </div>
            <div>
              <label htmlFor="referral_received_time">Referral received time</label>
              <input
                id="referral_received_time"
                name="referral_received_time"
                type="time"
                value={form.referral_received_time}
                onChange={handleField}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="service-memo-form-row">
            <label htmlFor="action_taken">Action taken / remarks</label>
            <textarea id="action_taken" name="action_taken" value={form.action_taken} onChange={handleField} disabled={readOnly} rows={4} />
          </div>
        </section>

        <section className="service-memo-form-section service-memo-band service-memo-band--site">
          <h4 className="service-memo-band-heading">Site timing</h4>
          <div className="service-memo-form-row two-col">
            <div>
              <label htmlFor="site_arrived_date">Date arrived on site (optional)</label>
              <input
                id="site_arrived_date"
                name="site_arrived_date"
                type="date"
                value={form.site_arrived_date}
                onChange={handleField}
                disabled={readOnly}
              />
            </div>
            <div>
              <label htmlFor="site_arrived_time">Time on site (optional)</label>
              <input
                id="site_arrived_time"
                name="site_arrived_time"
                type="time"
                value={form.site_arrived_time}
                onChange={handleField}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="service-memo-form-row two-col">
            <div>
              <label htmlFor="finished_date">Date finished</label>
              <input id="finished_date" name="finished_date" type="date" value={form.finished_date} onChange={handleField} disabled={readOnly} />
            </div>
            <div>
              <label htmlFor="finished_time">Time finished</label>
              <input id="finished_time" name="finished_time" type="time" value={form.finished_time} onChange={handleField} disabled={readOnly} />
            </div>
          </div>
        </section>

        <section className="service-memo-form-section service-memo-band service-memo-band--notes">
          <h4 className="service-memo-band-heading">Notes</h4>
          <div className="service-memo-form-row">
            <label htmlFor="internal_notes">Internal notes</label>
            <textarea id="internal_notes" name="internal_notes" value={form.internal_notes} onChange={handleField} disabled={readOnly} rows={2} />
          </div>
        </section>

        {memo?.created_at && (
          <p className="service-memo-meta-line">
            Created {formatToPhilippineTime(memo.created_at)} · Owner {memo.owner_email || '—'}
            {currentUserEmail && memo.owner_email !== currentUserEmail ? ' · View only — not owner' : ''}
          </p>
        )}
    </div>
  );

  return (
    <div
      className={mode === 'create' ? 'service-memo-form-root service-memo-form-root--create-nested' : 'service-memo-form-root'}
      data-mode={mode}
    >
      <div className="service-memo-form-toolbar">
        <button type="button" className="service-memo-btn service-memo-btn--secondary" onClick={onBack}>
          Back to list
        </button>
        {!readOnly && (
          <button type="button" className="service-memo-btn service-memo-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {mode === 'view' && (
          <button type="button" className="service-memo-btn service-memo-btn--print" onClick={() => window.print()}>
            Print
          </button>
        )}
      </div>

      {mode === 'create' ? (
        <div className="service-memo-create-shell">
          <div className="service-memo-create-shell-top">
            <ServiceMemoTopStrip {...stripProps} />
            {saveError && <p className="service-memo-inline-err">{saveError}</p>}
          </div>
          <div className="service-memo-create-shell-body">{renderFormGrid()}</div>
        </div>
      ) : (
        <>
          <ServiceMemoTopStrip {...stripProps} />
          {saveError && <p className="service-memo-inline-err">{saveError}</p>}
          {renderFormGrid()}
        </>
      )}
    </div>
  );
};

ServiceMemoForm.propTypes = {
  mode: PropTypes.oneOf(['create', 'update', 'view']).isRequired,
  memo: PropTypes.object,
  onBack: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
  onMemoNavigate: PropTypes.func,
  currentUserEmail: PropTypes.string,
  currentUserName: PropTypes.string,
};

export default ServiceMemoForm;
