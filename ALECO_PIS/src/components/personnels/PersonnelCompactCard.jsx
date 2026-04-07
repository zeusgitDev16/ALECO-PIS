import React, { useState, useCallback } from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import { personnelStatusSlug, personnelStatusLabel } from '../../utils/personnelStatusClass';
import { IconPencil, IconTrash, IconExpand, IconCopy } from '../interruptions/AdvisoryActionIcons';

/**
 * Compact personnel card — same structure/classes as InterruptionAdvisoryCard (actions: view, edit, delete).
 * @param {'crew'|'lineman'} props.variant
 * @param {object} props.crew - when variant crew
 * @param {object} props.lineman - when variant lineman
 * @param {() => void} props.onExpand
 * @param {() => void} props.onEdit
 * @param {() => void} props.onDelete
 * @param {(row: object) => void} [props.onCardClick] - mobile: whole card opens action modal
 * @param {boolean} props.saving
 */
export default function PersonnelCompactCard({
  variant,
  crew,
  lineman,
  onExpand,
  onEdit,
  onDelete,
  onCardClick,
  saving,
}) {
  const row = variant === 'crew' ? crew : lineman;
  if (!row) return null;

  const statusRaw = variant === 'crew' ? crew.status : lineman.status;
  const statusSlug = personnelStatusSlug(statusRaw);
  const statusLabel = personnelStatusLabel(statusRaw);

  const primaryLabel = variant === 'crew' ? 'Crew name' : 'Lineman';
  const title =
    variant === 'crew'
      ? String(crew.crew_name || '').trim() || '—'
      : String(lineman.full_name || '').trim() || '—';

  const preview =
    variant === 'lineman' ? String(lineman.designation || 'Lineman').trim() : '';

  const memberCount = variant === 'crew' ? crew.members?.length ?? crew.member_count ?? 0 : 0;
  const leadName =
    variant === 'crew' ? String(crew.lead_lineman_name || '').trim() || 'Unassigned' : '';

  const phone =
    variant === 'crew'
      ? formatPhoneDisplay(crew.phone_number) || toDisplayFormat(crew.phone_number) || crew.phone_number || '—'
      : formatPhoneDisplay(lineman.contact_no) || toDisplayFormat(lineman.contact_no) || lineman.contact_no || '—';

  const metaLabel = variant === 'crew' ? 'Phone' : 'Contact';

  const rawPhoneForCopy =
    variant === 'crew'
      ? String(crew.phone_number || '').trim()
      : String(lineman.contact_no || '').trim();

  const [phoneCopied, setPhoneCopied] = useState(false);

  const handleCopyPhone = useCallback(
    async (e) => {
      e.stopPropagation();
      const text = (rawPhoneForCopy && String(rawPhoneForCopy).trim()) || phone;
      if (!text || text === '—') return;
      try {
        await navigator.clipboard.writeText(text);
        setPhoneCopied(true);
        window.setTimeout(() => setPhoneCopied(false), 2000);
      } catch {
        /* ignore */
      }
    },
    [rawPhoneForCopy, phone]
  );

  const handleCardClick = () => {
    if (onCardClick) onCardClick(row);
  };

  const stop = (fn) => (e) => {
    e.stopPropagation();
    if (fn) fn();
  };

  return (
    <article
      className={`interruptions-admin-card interruptions-admin-card--compact personnel-card-interruptions${
        onCardClick ? ' interruptions-admin-card--mobile-clickable' : ''
      }`}
      onClick={onCardClick ? handleCardClick : undefined}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
    >
      <div className="interruptions-admin-card-head personnel-card-interruptions-head">
        <span className={`interruptions-admin-status-chip status-${statusSlug}`}>{statusLabel}</span>
        {variant !== 'crew' && <span className="interruptions-admin-type-pill">Pool</span>}
      </div>

      <div
        className={`interruptions-admin-card-identity interruptions-admin-card-identity--compact personnel-card-identity--centered`}
      >
        <div className="interruptions-admin-card-identity-main">
          <span className="interruptions-admin-card-feeder-label">{primaryLabel}</span>
          <h3 className="interruptions-admin-card-feeder-value interruptions-admin-card-feeder-value--compact">{title}</h3>
        </div>
        {variant !== 'crew' && (
          <span className="interruptions-admin-card-ref-id interruptions-admin-card-ref-id--compact">#{row.id}</span>
        )}
      </div>

      {variant === 'crew' ? (
        <div className="personnel-card-crew-body">
          <div className="personnel-card-stat personnel-card-stat--lead">
            <span className="personnel-card-stat-label">Lead</span>
            <div className="personnel-card-lead-banner">
              <span className="personnel-card-lead-star" aria-hidden>
                ★
              </span>
              <span className="personnel-card-lead-name">{leadName}</span>
            </div>
          </div>
          <div className="personnel-card-members-pill" title={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}>
            <span className="personnel-card-members-pill-label">Members</span>
            <span className="personnel-card-members-pill-count">{memberCount}</span>
          </div>
        </div>
      ) : (
        <div className="interruptions-admin-card-preview personnel-card-preview--centered">
          <p className="interruptions-admin-card-preview-text" title={preview}>
            {preview}
          </p>
        </div>
      )}

      <div className="personnel-card-phone-block personnel-card-phone-block--centered">
        <span className="personnel-card-phone-block-label">{metaLabel}</span>
        <div className="personnel-card-phone-highlight">
          <span className="personnel-card-phone-highlight-value">{phone}</span>
          {phone !== '—' && (
            <button
              type="button"
              className="personnel-card-phone-copy"
              onClick={handleCopyPhone}
              disabled={saving}
              title={phoneCopied ? 'Copied' : 'Copy number'}
              aria-label={phoneCopied ? 'Copied to clipboard' : 'Copy phone number'}
            >
              <IconCopy />
            </button>
          )}
        </div>
        {phoneCopied && (
          <span className="personnel-card-phone-copied-hint" role="status" aria-live="polite">
            Copied
          </span>
        )}
      </div>

      <div className="interruptions-admin-card-actions interruptions-admin-card-actions--compact">
        {onExpand && (
          <button
            type="button"
            className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--expand"
            onClick={stop(onExpand)}
            disabled={saving}
            title="View details"
            aria-label="View details"
          >
            <IconExpand />
          </button>
        )}
        <button
          type="button"
          className="interruptions-admin-btn interruptions-admin-btn--icon"
          onClick={stop(onEdit)}
          disabled={saving}
          title="Edit"
          aria-label="Edit"
        >
          <IconPencil />
        </button>
        <button
          type="button"
          className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--danger"
          onClick={stop(onDelete)}
          disabled={saving}
          title="Delete"
          aria-label="Delete"
        >
          <IconTrash />
        </button>
      </div>
    </article>
  );
}
