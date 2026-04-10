import React, { useState, useEffect, useMemo } from 'react';

/**
 * Contact form modal for creating or editing B2B contacts
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {object} props.contact - Contact to edit (null for new)
 * @param {Array} props.feederOptions - Array of {id, label} feeder options
 * @param {(data: object) => Promise<void>} props.onSave
 * @param {boolean} props.saving
 */
export default function B2BContactForm({
  isOpen,
  onClose,
  contact,
  feederOptions,
  onSave,
  saving,
}) {
  const isEdit = Boolean(contact?.id);
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    feederId: '',
    feederIds: [],
  });
  
  const [errors, setErrors] = useState([]);

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        companyName: contact.company_name || '',
        contactName: contact.contact_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        feederId: contact.feeder_id != null ? String(contact.feeder_id) : '',
        feederIds: Array.isArray(contact.feeder_ids) ? contact.feeder_ids : [],
      });
    } else {
      setFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        feederId: '',
        feederIds: [],
      });
    }
    setErrors([]);
  }, [contact, isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, saving, onClose]);

  const validate = () => {
    const errs = [];
    if (!formData.contactName.trim()) {
      errs.push('Contact name is required');
    }
    if (!formData.email.trim()) {
      errs.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.push('Please enter a valid email address');
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    const payload = {
      id: contact?.id || null,
      companyName: formData.companyName.trim(),
      contactName: formData.contactName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || null,
      feederId: formData.feederId ? Number(formData.feederId) : null,
      feederIds: formData.feederIds,
    };
    
    await onSave(payload);
    onClose();
  };

  const handleMultiFeederChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
    setFormData((prev) => ({ ...prev, feederIds: selected }));
  };

  if (!isOpen) return null;

  return (
    <div className="b2b-modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="b2b-modal b2b-contact-form-modal">
        <div className="b2b-modal-header">
          <h3>{isEdit ? 'Edit Contact' : 'New Contact'}</h3>
          <button
            type="button"
            className="b2b-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2b-modal-body">
          {errors.length > 0 && (
            <div className="b2b-form-errors">
              {errors.map((err, i) => (
                <div key={i} className="b2b-error">{err}</div>
              ))}
            </div>
          )}

          <div className="b2b-form-grid">
            <label className="b2b-form-field">
              <span>Contact Name *</span>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
                placeholder="e.g., Juan Dela Cruz"
                disabled={saving}
              />
            </label>

            <label className="b2b-form-field">
              <span>Email *</span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="e.g., contact@lgu.gov.ph"
                disabled={saving}
              />
            </label>

            <label className="b2b-form-field">
              <span>Company</span>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                placeholder="e.g., LGU San Jose"
                disabled={saving}
              />
            </label>

            <label className="b2b-form-field">
              <span>Phone</span>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="e.g., +63 912 345 6789"
                disabled={saving}
              />
            </label>

            <label className="b2b-form-field">
              <span>Primary Feeder</span>
              <select
                value={formData.feederId}
                onChange={(e) => setFormData((p) => ({ ...p, feederId: e.target.value }))}
                disabled={saving}
              >
                <option value="">Select a feeder...</option>
                {feederOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="b2b-form-field b2b-form-field-full">
            <span>Additional Feeders (multi-select)</span>
            <select
              multiple
              size={Math.min(5, Math.max(3, feederOptions.length))}
              value={formData.feederIds.map(String)}
              onChange={handleMultiFeederChange}
              disabled={saving}
              className="b2b-multiselect"
            >
              {feederOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <small className="b2b-form-hint">Hold Ctrl/Cmd to select multiple feeders</small>
          </label>

          <div className="b2b-modal-footer">
            <button
              type="button"
              className="b2b-btn b2b-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2b-btn b2b-btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : (isEdit ? 'Update Contact' : 'Create Contact')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
