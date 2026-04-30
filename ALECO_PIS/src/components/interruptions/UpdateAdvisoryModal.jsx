import React, { useState, useMemo, useEffect } from 'react';
import {
  STATUS_FORM_OPTIONS,
  getStatusDisplayLabel,
  getTypeDisplayLabel,
  isEmergencyOutageType,
  isInterruptionEnergizedStatus,
  interruptionStatusForCssClass,
} from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isoToDatetimeLocalPhilippine } from '../../utils/dateUtils';
import InModalDateTimePicker from './InModalDateTimePicker';
import { datetimeLocalToApi } from '../../utils/interruptionFormUtils';
import { formatPhilippineWallClock } from '../../utils/dateUtils';

function toDatetimeLocalFromDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function DatetimePreview({ value }) {
  const api = datetimeLocalToApi(value);
  if (!api) return null;
  return (
    <p className="interruptions-admin-datetime-preview">
      <span className="interruptions-admin-datetime-preview-label">Shows as:</span>{' '}
      {formatPhilippineWallClock(api)}
    </p>
  );
}

/** Pending is labeled "Scheduled" in this modal only (elsewhere remains "Upcoming"). */
function updateModalStatusLabel(status) {
  if (String(status || '') === 'Pending') return 'Scheduled';
  return getStatusDisplayLabel(status);
}

/**
 * UpdateAdvisoryModal — Dedicated modal for lifecycle status changes and remarks.
 * Separated from Edit Advisory to keep content editing and operational status updates distinct.
 *
 * @param {object} props
 * @param {object} props.item - The advisory row DTO (from list or detail)
 * @param {object[]} props.updates - Remarks/updates for this advisory
 * @param {boolean} props.detailLoading
 * @param {boolean} props.saving
 * @param {boolean} props.memoSaving
 * @param {{ type: string, text: string }|null} props.memoMessage
 * @param {{ type: string, text: string }|null} [props.saveMessage] - page-level message from saveAdvisory (errors)
 * @param {() => void} [props.onClearSaveMessage] - clear saveMessage when user edits the form
 * @param {(id: number, remark: string) => Promise<boolean>} props.onAddMemo
 * @param {(payload: object) => Promise<{ saved: boolean }>} props.onSaveStatus
 * @param {() => void} props.onClose
 */
export default function UpdateAdvisoryModal({
  item,
  updates = [],
  detailLoading = false,
  saving = false,
  memoSaving = false,
  memoMessage = null,
  saveMessage = null,
  onClearSaveMessage,
  onAddMemo,
  onSaveStatus,
  onClose,
}) {
  const [newStatus, setNewStatus] = useState(() =>
    isInterruptionEnergizedStatus(item?.status) ? 'Energized' : item?.status || 'Ongoing'
  );
  const [remark, setRemark] = useState('');
  const [dateTimeRestored, setDateTimeRestored] = useState('');
  const [memoDraft, setMemoDraft] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (item) {
      const st = item.status;
      setNewStatus(isInterruptionEnergizedStatus(st) ? 'Energized' : st);
      setRemark('');
      setDateTimeRestored(
        item.dateTimeRestored
          ? isoToDatetimeLocalPhilippine(item.dateTimeRestored)
          : ''
      );
      setValidationError('');
    }
  }, [item?.id]);

  const normalizedCurrentStatus = isInterruptionEnergizedStatus(item?.status) ? 'Energized' : item?.status;
  const statusIsChanging = newStatus !== normalizedCurrentStatus;
  const isPendingToOngoing = item?.status === 'Pending' && newStatus === 'Ongoing';
  const remarkRequired = statusIsChanging && !isPendingToOngoing;
  const showEnergizedFields = newStatus === 'Energized';

  const lifecycleSteps = useMemo(() => {
    if (isEmergencyOutageType(item?.type)) return ['Ongoing', 'Energized', 'Rescheduled', 'Cancelled'];
    return ['Pending', 'Ongoing', 'Energized', 'Rescheduled', 'Cancelled'];
  }, [item?.type]);

  const handleSubmitStatus = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!statusIsChanging) {
      setValidationError('Status has not changed. Select a new status to proceed.');
      return;
    }

    if (remarkRequired && !remark.trim()) {
      setValidationError('A remark is required when changing status (explain the reason).');
      return;
    }

    if (showEnergizedFields) {
      if (!dateTimeRestored || !String(dateTimeRestored).trim()) {
        setValidationError('Enter the actual re-energization date and time before marking as Energized.');
        return;
      }
    }

    const payload = {
      status: newStatus,
    };

    if (remarkRequired && remark.trim()) {
      payload.statusChangeRemark = remark.trim();
    }

    if (showEnergizedFields && dateTimeRestored) {
      payload.dateTimeRestored = datetimeLocalToApi(dateTimeRestored);
    }

    const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
    const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
    if (userEmail) payload.actorEmail = userEmail;
    if (userName) payload.actorName = userName;

    const result = await onSaveStatus(payload);
    if (result?.saved) {
      onClose();
    }
  };

  const handleAddMemo = async () => {
    const text = memoDraft.trim();
    if (!text || memoSaving) return;
    const ok = await onAddMemo(item.id, text);
    if (ok) setMemoDraft('');
  };

  if (!item) return null;

  return (
    <div
      className="interruptions-admin-modal-backdrop"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="interruptions-admin-modal interruptions-admin-modal--flexcol interruptions-admin-modal--update"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-advisory-modal-title"
      >
        <div className="interruptions-admin-modal-header">
          <h3 id="update-advisory-modal-title" className="header-title interruptions-admin-modal-title">
            Update advisory #{item.id}
          </h3>
          <button
            type="button"
            className="interruptions-admin-modal-close interruptions-admin-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="interruptions-admin-modal-scroll-outer">
          <div className="interruptions-admin-modal-body-scroll">
            {/* Advisory identity header */}
            <div className="update-advisory-identity">
              <span className={`interruptions-admin-status-chip status-${interruptionStatusForCssClass(item.status)}`}>
                {updateModalStatusLabel(item.status)}
              </span>
              <span className="interruptions-admin-type-pill">{getTypeDisplayLabel(item.type)}</span>
              <h4 className="update-advisory-feeder">{item.feeder || '—'}</h4>
              {item.controlNo && (
                <span className="update-advisory-control-no">{item.controlNo}</span>
              )}
            </div>

            {/* Status Change Section */}
            <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact">
              <legend>Change Lifecycle Status</legend>

              <div className="interruptions-admin-lifecycle-stepper" role="status" aria-live="polite">
                {lifecycleSteps.map((step, i) => (
                  <React.Fragment key={step}>
                    <div
                      className={`interruptions-admin-stepper-step${newStatus === step ? ` interruptions-admin-stepper-step--active interruptions-admin-stepper-step--${step.toLowerCase()}` : ''}`}
                    >
                      <span className="interruptions-admin-stepper-dot" aria-hidden="true" />
                      <span className="interruptions-admin-stepper-label">{updateModalStatusLabel(step)}</span>
                    </div>
                    {i < lifecycleSteps.length - 1 && (
                      <span className="interruptions-admin-stepper-connector" aria-hidden="true" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="interruptions-admin-form-grid interruptions-admin-form-grid--modal">
                <label className="interruptions-admin-span2">
                  New status
                  <select
                    value={newStatus}
                    className="interruptions-admin-lifecycle-dropdown"
                    onChange={(ev) => {
                      const v = ev.target.value;
                      setNewStatus(v);
                      setValidationError('');
                      onClearSaveMessage?.();
                      if (v === 'Energized' && !dateTimeRestored) {
                        setDateTimeRestored(toDatetimeLocalFromDate(new Date()));
                      }
                    }}
                  >
                    {STATUS_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {updateModalStatusLabel(o.value)}
                      </option>
                    ))}
                  </select>
                </label>

                {remarkRequired && (
                  <label className="interruptions-admin-span2">
                    <span>
                      Reason for status change <strong className="interruptions-admin-status-remark-required">(required)</strong>
                    </span>
                    <input
                      type="text"
                      value={remark}
                      onChange={(ev) => {
                        setRemark(ev.target.value);
                        setValidationError('');
                        onClearSaveMessage?.();
                      }}
                      placeholder="e.g. Power restored ahead of schedule, Crew confirmed re-energization…"
                      className="interruptions-admin-status-remark-input"
                    />
                  </label>
                )}

                {showEnergizedFields && (
                  <label className="interruptions-admin-span2 interruptions-admin-datetime-field">
                    Actual re-energization date and time
                    <div className="interruptions-admin-datetime-wrap">
                      <InModalDateTimePicker
                        value={dateTimeRestored}
                        onChange={(v) => {
                          setDateTimeRestored(v);
                          setValidationError('');
                          onClearSaveMessage?.();
                        }}
                        required
                        placeholder="Select re-energization date and time"
                      />
                    </div>
                    <DatetimePreview value={dateTimeRestored} />
                  </label>
                )}
              </div>

              {validationError && (
                <div className="interruptions-admin-callout interruptions-admin-callout--warn" role="alert">
                  {validationError}
                </div>
              )}

              {saveMessage &&
                (saveMessage.type === 'err' || saveMessage.type === 'conflict') &&
                saveMessage.text && (
                  <div className="interruptions-admin-callout interruptions-admin-callout--warn" role="alert">
                    {saveMessage.text}
                  </div>
                )}

              <div className="update-advisory-status-actions">
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--submit"
                  onClick={handleSubmitStatus}
                  disabled={saving || !statusIsChanging}
                >
                  {saving ? 'Saving…' : `Update to ${updateModalStatusLabel(newStatus)}`}
                </button>
              </div>
            </fieldset>

            {/* Remarks Section */}
            <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--memos">
              <legend>Remarks & Activity Log</legend>

              {detailLoading && <p className="interruptions-admin-memo-loading">Loading history…</p>}

              {!detailLoading && (
                <ul className="interruptions-admin-memo-list" aria-label="Remarks history">
                  {item.createdAt && (
                    <li className="interruptions-admin-memo-item interruptions-admin-memo-item--posted">
                      <div className="interruptions-admin-memo-meta">
                        <time dateTime={isoToDatetimeLocalPhilippine(item.createdAt)}>
                          {formatToPhilippineTime(item.createdAt)}
                        </time>
                        <span className="interruptions-admin-memo-kind">Posted</span>
                      </div>
                      <p className="interruptions-admin-memo-remark">Advisory published</p>
                    </li>
                  )}
                  {(updates || []).length === 0 ? (
                    <li className="interruptions-admin-memo-empty">No remarks yet.</li>
                  ) : (
                    (updates || []).map((u) => (
                      <li
                        key={u.id}
                        className={`interruptions-admin-memo-item interruptions-admin-memo-item--${u.kind === 'system' ? 'system' : 'user'}`}
                      >
                        <div className="interruptions-admin-memo-meta">
                          <time dateTime={isoToDatetimeLocalPhilippine(u.createdAt)}>
                            {formatToPhilippineTime(u.createdAt)}
                          </time>
                          <span className="interruptions-admin-memo-kind">
                            {u.kind === 'system' ? 'System' : u.actorName || u.actorEmail || 'Staff'}
                          </span>
                        </div>
                        <p className="interruptions-admin-memo-remark">{u.remark}</p>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {memoMessage && (
                <p className="interruptions-admin-msg" data-variant={memoMessage.type} role="status">
                  {memoMessage.text}
                </p>
              )}

              <div className="interruptions-admin-memo-form">
                <label className="interruptions-admin-span2">
                  Add remark
                  <textarea
                    className="interruptions-admin-memo-textarea"
                    value={memoDraft}
                    onChange={(ev) => setMemoDraft(ev.target.value)}
                    rows={3}
                    placeholder="e.g. Crew dispatched, ERT extended 2h, feeder re-energized…"
                    disabled={memoSaving || detailLoading}
                  />
                </label>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--submit"
                  disabled={memoSaving || detailLoading || !memoDraft.trim()}
                  onClick={handleAddMemo}
                >
                  {memoSaving ? 'Saving…' : 'Add remark'}
                </button>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="interruptions-admin-modal-footer">
          <button type="button" className="interruptions-admin-btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
