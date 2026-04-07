import React from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import { personnelStatusSlug, personnelStatusLabel } from '../../utils/personnelStatusClass';
import { IconPencil } from '../interruptions/AdvisoryActionIcons';

/**
 * Read-only detail modal for crew or lineman (mirrors interruption detail modal pattern).
 */
export default function PersonnelDetailModal({ variant, crew, lineman, onClose, onEdit, saving }) {
  const row = variant === 'crew' ? crew : lineman;
  if (!row) return null;

  const statusRaw = variant === 'crew' ? crew.status : lineman.status;
  const statusSlug = personnelStatusSlug(statusRaw);
  const statusLabel = personnelStatusLabel(statusRaw);

  const title =
    variant === 'crew'
      ? String(crew.crew_name || '').trim() || '—'
      : String(lineman.full_name || '').trim() || '—';

  const phone =
    variant === 'crew'
      ? formatPhoneDisplay(crew.phone_number) || toDisplayFormat(crew.phone_number) || crew.phone_number || '—'
      : formatPhoneDisplay(lineman.contact_no) || toDisplayFormat(lineman.contact_no) || lineman.contact_no || '—';

  return (
    <div
      className="interruption-detail-modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="interruption-detail-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="interruption-detail-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="interruption-detail-modal-inner">
          <article className="interruptions-admin-card interruptions-admin-card--detail-modal">
            <div className="interruptions-admin-card-head">
              <span className={`interruptions-admin-status-chip status-${statusSlug}`}>{statusLabel}</span>
              <span className="interruptions-admin-type-pill">{variant === 'crew' ? 'Crew' : 'Linemen pool'}</span>
            </div>

            <div className="interruptions-admin-card-identity">
              <div className="interruptions-admin-card-identity-main">
                <span className="interruptions-admin-card-feeder-label">{variant === 'crew' ? 'Crew name' : 'Name'}</span>
                <h3 className="interruptions-admin-card-feeder-value">{title}</h3>
              </div>
              <span className="interruptions-admin-card-ref-id" title="Record id">
                #{row.id}
              </span>
            </div>

            {variant === 'crew' ? (
              <>
                <div className="interruptions-admin-card-meta personnel-detail-meta-spaced">
                  <span className="interruptions-admin-card-meta-label">Lead</span>
                  <span className="interruptions-admin-card-meta-value">{crew.lead_lineman_name || '—'}</span>
                </div>
                <div className="interruptions-admin-card-meta">
                  <span className="interruptions-admin-card-meta-label">Members</span>
                  <span className="interruptions-admin-card-meta-value">
                    {crew.members?.length ?? crew.member_count ?? 0}
                  </span>
                </div>
                <div className="interruptions-admin-card-meta">
                  <span className="interruptions-admin-card-meta-label">Phone</span>
                  <span className="interruptions-admin-card-meta-value">{phone}</span>
                </div>
              </>
            ) : (
              <>
                <div className="interruptions-admin-card-meta personnel-detail-meta-spaced">
                  <span className="interruptions-admin-card-meta-label">Designation</span>
                  <span className="interruptions-admin-card-meta-value">{lineman.designation || '—'}</span>
                </div>
                <div className="interruptions-admin-card-meta">
                  <span className="interruptions-admin-card-meta-label">Contact</span>
                  <span className="interruptions-admin-card-meta-value">{phone}</span>
                </div>
                {(lineman.leave_start || lineman.leave_end || lineman.leave_reason) && (
                  <div className="interruptions-admin-card-body personnel-detail-meta-spaced">
                    <p className="interruptions-admin-card-body-text interruptions-admin-card-body-text--full">
                      Leave: {lineman.leave_start || '—'} → {lineman.leave_end || '—'}
                      {lineman.leave_reason ? `\n${lineman.leave_reason}` : ''}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="interruptions-admin-card-actions">
              {onEdit && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--icon"
                  onClick={() => onEdit(row)}
                  disabled={saving}
                  title="Edit"
                  aria-label="Edit"
                >
                  <IconPencil />
                </button>
              )}
              <button type="button" className="interruptions-admin-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
