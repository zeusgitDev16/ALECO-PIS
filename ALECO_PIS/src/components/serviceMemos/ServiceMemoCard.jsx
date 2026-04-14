import React from 'react';
import PropTypes from 'prop-types';
import { formatToPhilippineTime } from '../../utils/dateUtils';

const ServiceMemoCard = ({ memo, onEdit, onClose, onPrint, activeTab, currentUserEmail }) => {
  const isOwner = memo.owner_email === currentUserEmail;
  const fullName = memo.first_name && memo.last_name
    ? `${memo.first_name} ${memo.middle_name ? memo.middle_name + ' ' : ''}${memo.last_name}`.replace(/\s+/g, ' ').trim()
    : '—';

  const memoStatusClass = memo.memo_status?.toLowerCase() || 'draft';
  const ticketStatusClass = memo.ticket_status?.toLowerCase() || 'pending';
  const controlNumber = memo.control_number || 'N/A';

  return (
    <div className="service-memo-card">
      <div className="service-memo-card-header">
        <span className={`service-memo-status-badge service-memo-status-badge--${memoStatusClass}`}>
          {memo.memo_status}
        </span>
        <span className={`ticket-status-badge ticket-status-badge--${ticketStatusClass}`}>
          {memo.ticket_status}
        </span>
      </div>

      <div className="service-memo-card-body">
        <h3 className="service-memo-ticket-id">#{controlNumber} - {memo.ticket_id}</h3>
        
        <div className="service-memo-customer-info">
          <p className="service-memo-customer-name">{fullName}</p>
          {memo.phone_number && (
            <p className="service-memo-phone">{memo.phone_number}</p>
          )}
        </div>

        <div className="service-memo-location">
          <p>{memo.address || '—'}</p>
          {memo.municipality && <p>{memo.municipality}</p>}
        </div>

        <div className="service-memo-category">
          <span className="category-label">Category:</span>
          <span className="category-value">{memo.category || '—'}</span>
        </div>

        {memo.work_performed && (
          <div className="service-memo-preview">
            <p className="preview-label">Work Performed:</p>
            <p className="preview-text">{memo.work_performed.substring(0, 100)}{memo.work_performed.length > 100 ? '...' : ''}</p>
          </div>
        )}
      </div>

      <div className="service-memo-card-footer">
        <div className="service-memo-meta">
          <span className="meta-label">Owner:</span>
          <span className="meta-value">{memo.owner_name || '—'}</span>
        </div>
        <div className="service-memo-meta">
          <span className="meta-label">Created:</span>
          <span className="meta-value">{formatToPhilippineTime(memo.created_at)}</span>
        </div>
      </div>

      <div className="service-memo-card-actions">
        {(isOwner || activeTab === 'all') && (
          <button
            type="button"
            className="service-memo-action-btn service-memo-action-btn--edit"
            onClick={() => onEdit(memo)}
            title={isOwner ? 'Edit memo' : 'View memo'}
          >
            {isOwner ? 'Edit' : 'View'}
          </button>
        )}

        <button
          type="button"
          className="service-memo-action-btn service-memo-action-btn--print"
          onClick={() => onPrint(memo)}
          title="Print memo"
        >
          Print
        </button>

        {isOwner && memo.memo_status === 'saved' && (
          <button
            type="button"
            className="service-memo-action-btn service-memo-action-btn--close"
            onClick={() => onClose(memo)}
            title="Close memo"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

ServiceMemoCard.propTypes = {
  memo: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired,
  activeTab: PropTypes.string.isRequired,
  currentUserEmail: PropTypes.string,
};

export default ServiceMemoCard;
