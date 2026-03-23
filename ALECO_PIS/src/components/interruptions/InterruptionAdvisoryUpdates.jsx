import React, { useState } from 'react';
import { formatToPhilippineTime, isoToDatetimeLocalPhilippine } from '../../utils/dateUtils';

/**
 * @param {object} props
 * @param {number} props.interruptionId
 * @param {object[]} props.updates
 * @param {string|null} [props.createdAt] - advisory created_at for synthetic "Posted" entry
 * @param {boolean} props.detailLoading
 * @param {boolean} props.memoSaving
 * @param {{ type: string, text: string }|null} props.memoMessage
 * @param {(id: number, remark: string) => Promise<boolean>} props.onAddMemo
 * @param {boolean} [props.archivedReadOnly] - advisory is archived; memos cannot be added until restored
 */
export default function InterruptionAdvisoryUpdates({
  interruptionId,
  updates,
  createdAt,
  detailLoading,
  memoSaving,
  memoMessage,
  onAddMemo,
  archivedReadOnly = false,
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || memoSaving) return;
    const ok = await onAddMemo(interruptionId, text);
    if (ok) setDraft('');
  };

  return (
    <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--memos">
      <legend>Remarks (optional)</legend>
      <p className="interruptions-admin-field-hint">
        Optional notes for this advisory. A separate Service Memo feature will cover full audit trail across all features.
      </p>

      {detailLoading && <p className="interruptions-admin-memo-loading">Loading history…</p>}

      {!detailLoading && (
        <ul className="interruptions-admin-memo-list" aria-label="Remarks history">
          {createdAt && (
            <li className="interruptions-admin-memo-item interruptions-admin-memo-item--posted">
              <div className="interruptions-admin-memo-meta">
                <time dateTime={isoToDatetimeLocalPhilippine(createdAt)}>{formatToPhilippineTime(createdAt)}</time>
                <span className="interruptions-admin-memo-kind">Posted</span>
              </div>
              <p className="interruptions-admin-memo-remark">Posted at {formatToPhilippineTime(createdAt)}</p>
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
                  <time dateTime={isoToDatetimeLocalPhilippine(u.createdAt)}>{formatToPhilippineTime(u.createdAt)}</time>
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

      {archivedReadOnly && !detailLoading && (
        <p className="interruptions-admin-memo-archived-note" role="note">
          This advisory is <strong>archived</strong>. View only; remarks cannot be added.
        </p>
      )}

      <div className="interruptions-admin-memo-form">
        <label className="interruptions-admin-span2">
          Add remark
          <textarea
            className="interruptions-admin-memo-textarea"
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            rows={3}
            placeholder="e.g. Crew dispatched, ERT extended 2h, feeder re-energized…"
            disabled={memoSaving || detailLoading || archivedReadOnly}
          />
        </label>
        <button
          type="button"
          className="interruptions-admin-btn interruptions-admin-btn--submit"
          disabled={memoSaving || detailLoading || archivedReadOnly || !draft.trim()}
          onClick={handleAdd}
        >
          {memoSaving ? 'Saving…' : 'Add remark'}
        </button>
      </div>
    </fieldset>
  );
}
