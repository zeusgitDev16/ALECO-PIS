import React from 'react';
import PropTypes from 'prop-types';
import { formatToPhilippineTime } from '../../utils/dateUtils';

function IconView() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconCloseMemo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function truncate(str, max) {
  if (str == null || str === '') return '—';
  const s = String(str);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Service memo list row (compact table layout, ticket table–style).
 */
const ServiceMemoCard = ({
  memo,
  onView,
  onEdit,
  onClose,
  onRequestDelete,
  onPrint,
  currentUserEmail,
  selected = false,
  onToggleSelect,
}) => {
  const fullName =
    memo.first_name && memo.last_name
      ? `${memo.first_name} ${memo.middle_name ? memo.middle_name + ' ' : ''}${memo.last_name}`.replace(/\s+/g, ' ').trim()
      : '—';

  const memoStatusClass = memo.memo_status?.toLowerCase() || 'saved';
  const ticketStatusClass = (memo.ticket_status || 'pending').toLowerCase().replace(/\s/g, '');
  const controlNumber = memo.control_number || '—';
  const locationLine = [memo.address, memo.municipality].filter(Boolean).join(', ') || '—';

  const handleRowClick = () => {
    onView(memo.id);
  };

  const stop = (e) => {
    e.stopPropagation();
  };

  return (
    <tr
      className={`service-memo-list-row ${selected ? 'service-memo-list-row--selected' : ''}`}
      onClick={handleRowClick}
      role="row"
    >
      <td className="service-memo-list-col service-memo-list-col--check" onClick={stop}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(memo.id)}
          onClick={stop}
          aria-label={`Select memo ${controlNumber}`}
        />
      </td>
      <td className="service-memo-list-col service-memo-list-col--memo-id">
        <span className="service-memo-list-primary">{controlNumber}</span>
        <span className="service-memo-list-sub">{memo.ticket_id}</span>
      </td>
      <td className="service-memo-list-col service-memo-list-col--customer">
        <span className="service-memo-list-primary">{fullName}</span>
        {memo.phone_number && <span className="service-memo-list-sub">{memo.phone_number}</span>}
      </td>
      <td className="service-memo-list-col service-memo-list-col--location" title={locationLine}>
        {truncate(locationLine, 42)}
      </td>
      <td className="service-memo-list-col service-memo-list-col--category" title={memo.category || ''}>
        {truncate(memo.category, 28)}
      </td>
      <td className="service-memo-list-col service-memo-list-col--memo-st">
        <span className={`service-memo-status-badge service-memo-status-badge--${memoStatusClass}`}>{memo.memo_status}</span>
      </td>
      <td className="service-memo-list-col service-memo-list-col--ticket-st">
        <span className={`ticket-status-badge ticket-status-badge--${ticketStatusClass}`}>{memo.ticket_status}</span>
      </td>
      <td className="service-memo-list-col service-memo-list-col--owner" title={memo.owner_name || ''}>
        {truncate(memo.owner_name, 18)}
      </td>
      <td className="service-memo-list-col service-memo-list-col--created">
        {formatToPhilippineTime(memo.created_at)}
      </td>
      <td className="service-memo-list-col service-memo-list-col--actions" onClick={stop}>
        <div className="service-memo-list-actions">
          <button
            type="button"
            className="service-memo-list-action-btn service-memo-list-action-btn--icon"
            onClick={() => onView(memo.id)}
            title="View memo"
            aria-label="View memo"
          >
            <IconView />
          </button>
          {memo.memo_status !== 'closed' && (
            <button
              type="button"
              className="service-memo-list-action-btn service-memo-list-action-btn--icon"
              onClick={() => onEdit(memo.id)}
              title="Update memo"
              aria-label="Update memo"
            >
              <IconEdit />
            </button>
          )}
          <button
            type="button"
            className="service-memo-list-action-btn service-memo-list-action-btn--icon service-memo-list-action-btn--muted"
            onClick={() => onPrint(memo)}
            title="Print memo"
            aria-label="Print memo"
          >
            <IconPrint />
          </button>
          {memo.memo_status === 'saved' && (
            <button
              type="button"
              className="service-memo-list-action-btn service-memo-list-action-btn--icon service-memo-list-action-btn--warn"
              onClick={() => onClose(memo.id)}
              title="Close memo (finalize)"
              aria-label="Close memo (finalize)"
            >
              <IconCloseMemo />
            </button>
          )}
          {typeof onRequestDelete === 'function' && (
            <button
              type="button"
              className="service-memo-list-action-btn service-memo-list-action-btn--icon service-memo-list-action-btn--danger"
              onClick={() => onRequestDelete(memo)}
              title="Delete memo permanently"
              aria-label="Delete memo permanently"
            >
              <IconTrash />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

ServiceMemoCard.propTypes = {
  memo: PropTypes.object.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onRequestDelete: PropTypes.func,
  onPrint: PropTypes.func.isRequired,
  currentUserEmail: PropTypes.string,
  selected: PropTypes.bool,
  onToggleSelect: PropTypes.func.isRequired,
};

export default ServiceMemoCard;
