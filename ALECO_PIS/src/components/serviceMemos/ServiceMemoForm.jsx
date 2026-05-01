import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import {
  fetchTicketPreviewForMemo,
  createServiceMemo,
  updateServiceMemo,
  deleteServiceMemo,
  allocateControlNumber,
} from '../../api/serviceMemosApi';
import ConfirmModal from '../tickets/ConfirmModal';
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

function toDateInputValue(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  // Accept ISO / MySQL datetime and keep YYYY-MM-DD for <input type="date">
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return fallback;
}

function toTimeInputValue(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  // Accept HH:mm or HH:mm:ss and keep HH:mm for <input type="time">
  const match = raw.match(/^(\d{2}:\d{2})/);
  if (match) return match[1];
  return fallback;
}

const CLOSED_TICKET_STATUSES = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];

const MEMO_SAVE_STATUS_TOAST =
  'Service memo can only be saved when the ticket is closed: Restored, Unresolved, NoFaultFound, or AccessDenied. Pending and Ongoing are not allowed.';

/** Top-strip banner (same pattern as Users → Invite: info banner + short toast on action). */
const EXISTING_MEMO_BANNER_TEXT =
  'A service memo is already linked to this ticket. You cannot generate another control number here. Open the existing memo from the Service memos list, or delete it first if you must create a new memo.';

const EXISTING_MEMO_GENERATE_TOAST =
  'A service memo already exists for this ticket — open it from the list or delete it first.';

/** Ticket row from filtered-tickets: FK on aleco_tickets and/or any aleco_service_memos row for this ticket. */
function ticketAlreadyHasServiceMemo(ticket) {
  if (!ticket) return false;
  if (ticket.has_service_memo === true || ticket.has_service_memo === 1) return true;
  const sid = ticket.service_memo_id;
  if (sid != null && sid !== '' && Number(sid) !== 0) return true;
  return false;
}

/** Street + municipality from `aleco_tickets` (memo prefix uses municipality). */
function addressWithMunicipalityFromTicket(t) {
  if (!t) return '';
  const street = t.address != null ? String(t.address).trim() : '';
  const muni = t.municipality != null ? String(t.municipality).trim() : '';
  return [street, muni].filter(Boolean).join(', ');
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
  municipality: '',
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
  currentUserEmail,
  currentUserName,
  showCloseMemoFinalize,
  onCloseMemoFinalize,
  onDeleted,
  onSwitchToEdit,
}) => {
  const readOnly = mode === 'view';
  const stripVariant = mode === 'create' ? 'input' : mode === 'update' ? 'update' : 'display';

  const [ticketPreview, setTicketPreview] = useState(null);
  const [stripValues, setStripValues] = useState(emptyStrip);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [allocateBusy, setAllocateBusy] = useState(false);
  const [memoAllocateError, setMemoAllocateError] = useState(null);
  const [ticketVerifyBusy, setTicketVerifyBusy] = useState(false);
  const [ticketLookupError, setTicketLookupError] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /** Invalidates in-flight debounced / manual ticket lookups when the input changes or Load runs. */
  const ticketVerifyGenRef = useRef(0);

  const displayTicket = useMemo(() => {
    if (mode === 'create' && ticketPreview) return ticketPreview;
    if (memo && memo.ticket_id) return memo;
    return null;
  }, [mode, ticketPreview, memo]);

  const syncStripFromTicket = useCallback((t) => {
    if (!t) return;
    const name = [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const nextTid = t.ticket_id ?? '';
    setStripValues((prev) => {
      const sameTicket = (prev.ticket_id || '') === nextTid;
      return {
        ...prev,
        account_number: t.account_number ?? prev.account_number ?? '',
        customer_name: name || prev.customer_name || '',
        address: addressWithMunicipalityFromTicket(t),
        municipality: t.municipality != null ? String(t.municipality).trim() : '',
        ticket_query: t.ticket_id ?? prev.ticket_query ?? '',
        ticket_id: nextTid,
        control_number: sameTicket ? prev.control_number : '',
      };
    });
  }, []);

  const syncStripFromMemo = useCallback((m) => {
    if (!m) return;
    const name = m.requested_by || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ').trim();
    setStripValues({
      account_number: m.account_number ?? '',
      customer_name: name || '',
      address: [m.location || m.address, m.municipality].filter(Boolean).join(', ') || m.location || m.address || '',
      municipality: m.municipality != null ? String(m.municipality).trim() : '',
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
      setTicketLookupError(null);
      setTicketVerifyBusy(false);
      ticketVerifyGenRef.current += 1;
    }
  }, [mode]);

  /** Debounced: verify ticket ID against DB (exact match) while typing — same as Load, no button required. */
  useEffect(() => {
    if (mode !== 'create') return undefined;

    const q = (stripValues.ticket_query ?? '').trim();
    if (!q) {
      ticketVerifyGenRef.current += 1;
      setTicketVerifyBusy(false);
      setTicketLookupError(null);
      setTicketPreview(null);
      setForm((f) => ({ ...f, ticket_id: '' }));
      setStripValues(emptyStrip());
      return undefined;
    }

    if (ticketPreview?.ticket_id === q) {
      setTicketVerifyBusy(false);
      setTicketLookupError(null);
      return undefined;
    }

    ticketVerifyGenRef.current += 1;
    const token = ticketVerifyGenRef.current;
    setTicketVerifyBusy(true);
    setTicketLookupError(null);

    const timer = setTimeout(async () => {
      if (token !== ticketVerifyGenRef.current) return;
      try {
        const r = await fetchTicketPreviewForMemo(q, { exactMatchOnly: true });
        if (token !== ticketVerifyGenRef.current) return;
        setTicketVerifyBusy(false);
        if (!r.ok || !r.ticket) {
          setTicketPreview(null);
          setTicketLookupError(r.message || 'Ticket not found.');
          setForm((f) => ({ ...f, ticket_id: '' }));
          return;
        }
        setTicketLookupError(null);
        setTicketPreview(r.ticket);
        syncStripFromTicket(r.ticket);
        setForm((f) => ({
          ...f,
          ticket_id: r.ticket.ticket_id,
          received_by: f.received_by || currentUserName || '',
        }));
      } catch {
        if (token !== ticketVerifyGenRef.current) return;
        setTicketVerifyBusy(false);
        setTicketPreview(null);
        setTicketLookupError('Could not verify ticket.');
        setForm((f) => ({ ...f, ticket_id: '' }));
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [mode, stripValues.ticket_query, ticketPreview?.ticket_id, syncStripFromTicket, currentUserName]);

  useEffect(() => {
    if (!memo || mode === 'create') return;
    setForm({
      ticket_id: memo.ticket_id || '',
      received_by: memo.received_by || '',
      intake_date: toDateInputValue(memo.intake_date || memo.service_date, todayDateStr()),
      intake_time: toTimeInputValue(memo.intake_time, nowTimeStr()),
      referred_to: memo.referred_to || '',
      referral_received_date: toDateInputValue(memo.referral_received_date, todayDateStr()),
      referral_received_time: toTimeInputValue(memo.referral_received_time, nowTimeStr()),
      action_taken: memo.action_taken || memo.work_performed || '',
      site_arrived_date: toDateInputValue(memo.site_arrived_date, ''),
      site_arrived_time: toTimeInputValue(memo.site_arrived_time, ''),
      finished_date: toDateInputValue(memo.finished_date, todayDateStr()),
      finished_time: toTimeInputValue(memo.finished_time, nowTimeStr()),
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
    setMemoAllocateError(null);
    setTicketLookupError(null);
    const q = stripValues.ticket_query?.trim() || '';
    if (!q) {
      setLoadError('Enter a ticket ID.');
      return;
    }
    ticketVerifyGenRef.current += 1;
    const token = ticketVerifyGenRef.current;
    setTicketVerifyBusy(true);
    const r = await fetchTicketPreviewForMemo(q, { exactMatchOnly: true });
    if (token !== ticketVerifyGenRef.current) return;
    setTicketVerifyBusy(false);
    if (!r.ok || !r.ticket) {
      setTicketPreview(null);
      setLoadError(r.message || 'Ticket not found.');
      setForm((f) => ({ ...f, ticket_id: '' }));
      return;
    }
    setLoadError(null);
    setTicketPreview(r.ticket);
    syncStripFromTicket(r.ticket);
    setForm((f) => ({
      ...f,
      ticket_id: r.ticket.ticket_id,
      received_by: f.received_by || currentUserName || '',
    }));
  };

  const handleGenerateMemoCode = async () => {
    const q = (stripValues.ticket_query ?? '').trim();
    if (mode !== 'create' || !ticketPreview?.ticket_id || ticketPreview.ticket_id !== q) return;
    if (ticketAlreadyHasServiceMemo(ticketPreview)) {
      toast.info(EXISTING_MEMO_GENERATE_TOAST);
      return;
    }
    setMemoAllocateError(null);
    setAllocateBusy(true);
    try {
      const r = await allocateControlNumber(ticketPreview.ticket_id);
      if (!r.success || !r.data?.control_number) {
        const msg = r.message || 'Could not load memo number preview.';
        setMemoAllocateError(msg);
        toast.error(msg);
        return;
      }
      setStripValues((prev) => ({ ...prev, control_number: r.data.control_number }));
    } finally {
      setAllocateBusy(false);
    }
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
      photo_url: photoUrl && String(photoUrl).trim() ? String(photoUrl).trim() : null,
    };
    const catRaw =
      displayTicket?.category != null && String(displayTicket.category).trim() !== ''
        ? String(displayTicket.category).trim()
        : '';
    if (catRaw !== '') {
      base.category = catRaw;
    }
    if (mode === 'create') {
      const cn = stripValues.control_number?.trim();
      if (cn) base.control_number = cn.toUpperCase();
    }
    return base;
  };

  const handleSave = async () => {
    setSaveError(null);
    if (mode === 'create' && !ticketPreview) {
      toast.warning('Enter a valid ticket ID and wait until it is verified.');
      return;
    }
    if (mode === 'create' && ticketPreview && ticketAlreadyHasServiceMemo(ticketPreview)) {
      toast.info(EXISTING_MEMO_GENERATE_TOAST);
      return;
    }
    if (mode === 'create') {
      if (!CLOSED_TICKET_STATUSES.includes(ticketPreview?.status)) {
        toast.error(MEMO_SAVE_STATUS_TOAST);
        return;
      }
      if (!stripValues.control_number?.trim()) {
        toast.warning('Generate a memo number before saving.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        const r = await createServiceMemo(payload);
        if (!r.success) {
          const msg = r.message || 'Could not create service memo.';
          toast.error(msg);
          setSaveError(msg);
          return;
        }
        toast.success('Service memo saved.');
        onSaved?.(r.data);
      } else if (mode === 'update' && memo?.id) {
        const r = await updateServiceMemo(memo.id, { ...payload }, memo?.updated_at ?? null);
        if (r.conflict) {
          const msg = 'This memo was updated by someone else. Please go back and reload.';
          toast.error(msg);
          setSaveError(msg);
          return;
        }
        if (!r.success) {
          const msg = r.message || 'Could not save.';
          toast.error(msg);
          setSaveError(msg);
          return;
        }
        toast.success('Service memo saved.');
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
      const loc = memo.location || memo.address || '';
      const muni = memo.municipality != null ? String(memo.municipality).trim() : '';
      return {
        account_number: memo.account_number ?? '',
        customer_name: memo.requested_by || fullName,
        address: [loc, muni].filter(Boolean).join(', ') || loc,
        municipality: muni,
        control_number: memo.control_number || '',
        ticket_id: memo.ticket_id || '',
      };
    }
    if (mode === 'create') {
      return {
        ...stripValues,
        control_number: stripValues.control_number || '',
        ticket_id: ticketPreview?.ticket_id || '',
      };
    }
    if (mode === 'update' && memo) {
      const muni = memo.municipality != null ? String(memo.municipality).trim() : '';
      const loc = stripValues.address || memo.location || memo.address || '';
      return {
        ...stripValues,
        account_number: stripValues.account_number || memo.account_number || '',
        customer_name: stripValues.customer_name || memo.requested_by || fullName,
        address: [loc, muni].filter(Boolean).join(', ') || loc,
        municipality: stripValues.municipality || muni,
        control_number: memo.control_number || '',
        ticket_id: memo.ticket_id || '',
      };
    }
    return stripValues;
  }, [mode, memo, stripValues, ticketPreview, fullName]);

  const ticketIdTrimmed = (stripValues.ticket_query ?? '').trim();
  const ticketVerifiedForStrip =
    Boolean(ticketPreview?.ticket_id) && ticketPreview.ticket_id === ticketIdTrimmed;
  const ticketBlocksNewMemo = mode === 'create' && ticketPreview && ticketAlreadyHasServiceMemo(ticketPreview);
  const ticketReadyForMemoAllocate =
    ticketVerifiedForStrip && !ticketVerifyBusy && !ticketBlocksNewMemo;

  const canDeleteMemo =
    Boolean(memo?.id) &&
    (mode === 'view' || mode === 'update');

  const handleConfirmDeleteMemo = async () => {
    if (!memo?.id || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const r = await deleteServiceMemo(memo.id);
      if (r.success) {
        toast.success('Service memo deleted.');
        window.dispatchEvent(new Event('service-memo-deleted'));
        setDeleteModalOpen(false);
        onDeleted?.();
      } else {
        toast.error(r.message || 'Could not delete memo.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const stripProps = {
    variant: stripVariant,
    values: stripPropsValues,
    onChange: handleStripChange,
    onLoadTicket: handleLoadTicket,
    loadError: loadError || ticketLookupError,
    ticketVerifyBusy: mode === 'create' ? ticketVerifyBusy : false,
    disabled: readOnly,
    photoUrl,
    onPhotoChange: handlePhotoChange,
    onPhotoRemove: handlePhotoRemove,
    onGenerateMemoCode: mode === 'create' ? handleGenerateMemoCode : undefined,
    generateMemoBusy: allocateBusy,
    canGenerateMemoNumber: ticketReadyForMemoAllocate,
    memoAllocateError,
    existingMemoNotice: mode === 'create' && ticketBlocksNewMemo ? EXISTING_MEMO_BANNER_TEXT : null,
  };

  const renderFormGrid = () => (
    <div className="service-memo-form-grid">
        <section className="service-memo-form-section service-memo-band service-memo-band--request">
          <h4 className="service-memo-band-heading">Request / ticket</h4>
          {mode === 'update' && (
            <p className="service-memo-band-hint">
              Intake, referral, site timing, and notes below can be updated here. Customer and account snapshots come from the linked ticket—change those on the ticket record if needed.
            </p>
          )}
          <div className="service-memo-form-row">
            <label>Ticket ID</label>
            <input type="text" readOnly value={displayTicket?.ticket_id ?? ''} />
          </div>
          <div className="service-memo-form-row">
            <label>Category</label>
            <input
              type="text"
              readOnly
              value={
                displayTicket?.category != null && String(displayTicket.category).trim() !== ''
                  ? String(displayTicket.category).trim()
                  : ''
              }
            />
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
            Created {formatToPhilippineTime(memo.created_at)} · Received by {memo.owner_email || '—'}
            {currentUserEmail && memo.owner_email !== currentUserEmail ? ' · View only — not recorded as received by you' : ''}
          </p>
        )}
    </div>
  );

  return (
    <div className="service-memo-form-root service-memo-form-root--create-nested" data-mode={mode}>
      <div className="service-memo-form-toolbar">
        <button type="button" className="service-memo-btn service-memo-btn--secondary" onClick={onBack}>
          Back to list
        </button>
        {!readOnly && (
          <button type="button" className="service-memo-btn service-memo-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {mode === 'view' && memo?.memo_status !== 'closed' && typeof onSwitchToEdit === 'function' && (
          <button type="button" className="service-memo-btn service-memo-btn--primary" onClick={onSwitchToEdit}>
            Edit
          </button>
        )}
        {mode === 'view' && showCloseMemoFinalize && typeof onCloseMemoFinalize === 'function' && (
          <button type="button" className="service-memo-btn service-memo-btn--close" onClick={onCloseMemoFinalize}>
            Close Memo
          </button>
        )}
        {mode === 'view' && (
          <button type="button" className="service-memo-btn service-memo-btn--print" onClick={() => window.print()}>
            Print
          </button>
        )}
        {canDeleteMemo && (
          <button
            type="button"
            className="service-memo-btn service-memo-btn--danger"
            disabled={deleteBusy || saving}
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </button>
        )}
      </div>

      <div className="service-memo-create-shell">
        <div className="service-memo-create-shell-top">
          <ServiceMemoTopStrip {...stripProps} />
          {saveError && <p className="service-memo-inline-err">{saveError}</p>}
        </div>
        <div className="service-memo-create-shell-body">
          {renderFormGrid()}
          {mode === 'update' && showCloseMemoFinalize && typeof onCloseMemoFinalize === 'function' && (
            <div className="service-memo-close-row">
              <button type="button" className="service-memo-btn service-memo-btn--close" onClick={() => onCloseMemoFinalize()}>
                Close memo (finalize)
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => !deleteBusy && setDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteMemo}
        title="Delete service memo permanently?"
        message={
          memo
            ? `Memo ${memo.control_number || `#${memo.id}`} (ticket ${memo.ticket_id || '—'}) will be removed from the database. The ticket link to this memo will be cleared. This cannot be undone.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete permanently'}
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};

ServiceMemoForm.propTypes = {
  mode: PropTypes.oneOf(['create', 'update', 'view']).isRequired,
  memo: PropTypes.object,
  onBack: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
  currentUserEmail: PropTypes.string,
  currentUserName: PropTypes.string,
  showCloseMemoFinalize: PropTypes.bool,
  onCloseMemoFinalize: PropTypes.func,
  onDeleted: PropTypes.func,
  onSwitchToEdit: PropTypes.func,
};

export default ServiceMemoForm;
