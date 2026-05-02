import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import { useServiceMemoPrint } from '../../hooks/useServiceMemoPrint';

const ServiceMemoModal = ({ memo, isOpen, onClose, onSave, onCloseMemo, currentUserEmail }) => {
  const { printMemo } = useServiceMemoPrint();

  const [formData, setFormData] = useState({
    work_performed: '',
    resolution_details: '',
    internal_notes: '',
    service_date: '',
    received_by: '',
    referred_to: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = memo?.owner_email === currentUserEmail;
  const isClosed = memo?.memo_status === 'closed';
  const isEditable = isOwner && !isClosed;

  useEffect(() => {
    if (memo && isOpen) {
      setFormData({
        work_performed: memo.work_performed || '',
        resolution_details: memo.resolution_details || '',
        internal_notes: memo.internal_notes || '',
        service_date: memo.service_date || new Date().toISOString().split('T')[0],
        received_by: memo.received_by || '',
        referred_to: memo.referred_to || '',
      });
    }
  }, [memo, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!isEditable) return;
    
    setIsSaving(true);
    try {
      const result = await onSave(memo.id, formData);
      if (result.saved) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseMemo = async () => {
    if (!isEditable) return;
    
    setIsSaving(true);
    try {
      const result = await onCloseMemo(memo.id);
      if (result.closed) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (memo) printMemo(memo);
  };

  if (!isOpen || !memo) return null;

  const fullName = memo.first_name && memo.last_name
    ? `${memo.first_name} ${memo.middle_name ? memo.middle_name + ' ' : ''}${memo.last_name}`.replace(/\s+/g, ' ').trim()
    : '—';

  return (
    <div className="service-memo-modal-backdrop" onClick={onClose}>
      <div className="service-memo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="service-memo-modal-header">
          <h3>Service Memo - {memo.control_number || 'N/A'}</h3>
          <button className="service-memo-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="service-memo-modal-body">
          {/* Ticket Information Section */}
          <div className="service-memo-section">
            <h4 className="service-memo-section-title">Ticket Information</h4>
            <div className="service-memo-info-grid">
              <div className="service-memo-info-item">
                <label>Ticket ID:</label>
                <p>{memo.ticket_id}</p>
              </div>
              <div className="service-memo-info-item">
                <label>Customer Name:</label>
                <p>{fullName}</p>
              </div>
              {memo.phone_number && (
                <div className="service-memo-info-item">
                  <label>Phone Number:</label>
                  <p>{memo.phone_number}</p>
                </div>
              )}
              <div className="service-memo-info-item full-width">
                <label>Location:</label>
                <p>{memo.address || '—'}{memo.municipality ? `, ${memo.municipality}` : ''}</p>
              </div>
              <div className="service-memo-info-item">
                <label>Category:</label>
                <p>{memo.category || '—'}</p>
              </div>
              <div className="service-memo-info-item">
                <label>Ticket Status:</label>
                <p>{memo.ticket_status || '—'}</p>
              </div>
              {memo.assigned_crew && (
                <div className="service-memo-info-item">
                  <label>Crew Assigned:</label>
                  <p>{memo.assigned_crew}</p>
                </div>
              )}
              {memo.dispatched_at && (
                <div className="service-memo-info-item">
                  <label>Dispatched At:</label>
                  <p>{formatToPhilippineTime(memo.dispatched_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Concern and Action Desired Section */}
          <div className="service-memo-section">
            <h4 className="service-memo-section-title">Issue Details</h4>
            <div className="service-memo-info-item full-width">
              <label>User's Concern:</label>
              <div className="service-memo-text-box">{memo.concern || '—'}</div>
            </div>
            <div className="service-memo-info-item full-width">
              <label>Action Desired:</label>
              <div className="service-memo-text-box">{memo.action_desired || '—'}</div>
            </div>
          </div>

          {/* Service Memo Details Section */}
          <div className="service-memo-section">
            <h4 className="service-memo-section-title">Service Memo Details</h4>
            <div className="service-memo-info-grid">
              <div className="service-memo-info-item">
                <label htmlFor="service_date">Service Date *</label>
                <input
                  id="service_date"
                  type="date"
                  name="service_date"
                  value={formData.service_date}
                  onChange={handleChange}
                  disabled={!isEditable}
                />
              </div>
              <div className="service-memo-info-item">
                <label htmlFor="received_by">Received By</label>
                <input
                  id="received_by"
                  type="text"
                  name="received_by"
                  value={formData.received_by}
                  onChange={handleChange}
                  disabled={!isEditable}
                  placeholder="Name of person who received request"
                />
              </div>
              <div className="service-memo-info-item full-width">
                <label htmlFor="referred_to">Referred To</label>
                <input
                  id="referred_to"
                  type="text"
                  name="referred_to"
                  value={formData.referred_to}
                  onChange={handleChange}
                  disabled={!isEditable}
                  placeholder="Name of person/team referred to"
                />
              </div>
            </div>
          </div>

          {/* Service Memo Content Section */}
          <div className="service-memo-section">
            <h4 className="service-memo-section-title">Service Memo Content</h4>
            <div className="service-memo-form-group">
              <label htmlFor="work_performed">Work Performed *</label>
              <textarea
                id="work_performed"
                name="work_performed"
                value={formData.work_performed}
                onChange={handleChange}
                disabled={!isEditable}
                rows={4}
                placeholder="Describe the work performed..."
              />
            </div>
            <div className="service-memo-form-group">
              <label htmlFor="resolution_details">Resolution Details *</label>
              <textarea
                id="resolution_details"
                name="resolution_details"
                value={formData.resolution_details}
                onChange={handleChange}
                disabled={!isEditable}
                rows={4}
                placeholder="Describe the resolution details..."
              />
            </div>
            <div className="service-memo-form-group">
              <label htmlFor="internal_notes">Internal Notes (Optional)</label>
              <textarea
                id="internal_notes"
                name="internal_notes"
                value={formData.internal_notes}
                onChange={handleChange}
                disabled={!isEditable}
                rows={3}
                placeholder="Add any internal notes..."
              />
            </div>
          </div>

          {/* Metadata Section */}
          <div className="service-memo-section">
            <h4 className="service-memo-section-title">Metadata</h4>
            <div className="service-memo-info-grid">
              <div className="service-memo-info-item">
                <label>Created By:</label>
                <p>{memo.owner_name || '—'}</p>
              </div>
              <div className="service-memo-info-item">
                <label>Created At:</label>
                <p>{formatToPhilippineTime(memo.created_at)}</p>
              </div>
              <div className="service-memo-info-item">
                <label>Memo Status:</label>
                <p>{memo.memo_status}</p>
              </div>
              {memo.closed_at && (
                <div className="service-memo-info-item">
                  <label>Closed At:</label>
                  <p>{formatToPhilippineTime(memo.closed_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="service-memo-modal-footer">
          <button
            type="button"
            className="service-memo-btn service-memo-btn--print"
            onClick={handlePrint}
            title="Print memo"
          >
            Print
          </button>
          
          {isEditable && (
            <>
              <button
                type="button"
                className="service-memo-btn service-memo-btn--secondary"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              
              {memo.memo_status === 'saved' && (
                <button
                  type="button"
                  className="service-memo-btn service-memo-btn--close"
                  onClick={handleCloseMemo}
                  disabled={isSaving}
                >
                  {isSaving ? 'Closing...' : 'Close Memo'}
                </button>
              )}
              
              <button
                type="button"
                className="service-memo-btn service-memo-btn--primary"
                onClick={handleSave}
                disabled={isSaving || !formData.work_performed.trim() || !formData.resolution_details.trim()}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}

          {!isEditable && (
            <button
              type="button"
              className="service-memo-btn service-memo-btn--secondary"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

ServiceMemoModal.propTypes = {
  memo: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCloseMemo: PropTypes.func.isRequired,
  currentUserEmail: PropTypes.string,
};

export default ServiceMemoModal;
