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
  const [isFeederPickerOpen, setIsFeederPickerOpen] = useState(false);
  const [feederSearch, setFeederSearch] = useState('');
  const [draftFeederIds, setDraftFeederIds] = useState([]);

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

  const selectedAdditionalFeeders = useMemo(
    () =>
      feederOptions.filter((f) =>
        formData.feederIds.map(Number).includes(Number(f.id))
      ),
    [feederOptions, formData.feederIds]
  );

  const filteredFeederOptions = useMemo(() => {
    const q = feederSearch.trim().toLowerCase();
    return feederOptions.filter((f) => {
      if (!q) return true;
      return String(f.label || '')
        .toLowerCase()
        .includes(q);
    });
  }, [feederOptions, feederSearch]);

  const openFeederPicker = () => {
    setDraftFeederIds(formData.feederIds.map(Number));
    setFeederSearch('');
    setIsFeederPickerOpen(true);
  };

  const closeFeederPicker = () => {
    setIsFeederPickerOpen(false);
    setFeederSearch('');
  };

  const applyFeederPicker = () => {
    setFormData((prev) => ({ ...prev, feederIds: [...new Set(draftFeederIds)] }));
    closeFeederPicker();
  };

  const toggleDraftFeeder = (id) => {
    setDraftFeederIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allVisibleSelected =
    filteredFeederOptions.length > 0 &&
    filteredFeederOptions.every((f) => draftFeederIds.includes(Number(f.id)));

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredFeederOptions.map((f) => Number(f.id));
    setDraftFeederIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...prev, ...visibleIds])];
    });
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

        <form onSubmit={handleSubmit} className="b2b-modal-form">
          <div className="b2b-modal-body b2b-contact-modal-body">
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

            <div className="b2b-feeder-selector-card">
              <div className="b2b-feeder-selector-header">
                <div>
                  <span className="b2b-feeder-selector-title">Additional Feeders</span>
                  <p className="b2b-feeder-selector-subtitle">
                    {selectedAdditionalFeeders.length > 0
                      ? `${selectedAdditionalFeeders.length} selected`
                      : 'No additional feeders selected'}
                  </p>
                </div>
                <div className="b2b-feeder-selector-actions">
                  <button
                    type="button"
                    className="b2b-btn b2b-btn-secondary"
                    onClick={openFeederPicker}
                    disabled={saving}
                  >
                    Select Feeders
                  </button>
                  {formData.feederIds.length > 0 && (
                    <button
                      type="button"
                      className="b2b-btn b2b-btn-ghost"
                      onClick={() => setFormData((prev) => ({ ...prev, feederIds: [] }))}
                      disabled={saving}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {selectedAdditionalFeeders.length > 0 && (
                <div className="b2b-feeder-chip-list">
                  {selectedAdditionalFeeders.slice(0, 4).map((f) => (
                    <span key={f.id} className="b2b-feeder-chip">{f.label}</span>
                  ))}
                  {selectedAdditionalFeeders.length > 4 && (
                    <span className="b2b-feeder-chip b2b-feeder-chip-more">
                      +{selectedAdditionalFeeders.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

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

      {isFeederPickerOpen && (
        <div
          className="b2b-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeFeederPicker()}
        >
          <div className="b2b-modal b2b-feeder-picker-modal">
            <div className="b2b-modal-header">
              <h3>Select Additional Feeders</h3>
              <button
                type="button"
                className="b2b-modal-close"
                onClick={closeFeederPicker}
                aria-label="Close feeder picker"
              >
                ×
              </button>
            </div>
            <div className="b2b-modal-body b2b-feeder-picker-body">
              <div className="b2b-feeder-picker-tools">
                <input
                  type="search"
                  className="b2b-feeder-search"
                  placeholder="Search feeders..."
                  value={feederSearch}
                  onChange={(e) => setFeederSearch(e.target.value)}
                />
                <label className="b2b-feeder-select-all">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                  <span>Select all visible</span>
                </label>
              </div>

              <div className="b2b-feeder-picker-list">
                {filteredFeederOptions.map((f) => {
                  const checked = draftFeederIds.includes(Number(f.id));
                  return (
                    <label key={f.id} className="b2b-feeder-option-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDraftFeeder(Number(f.id))}
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
                {filteredFeederOptions.length === 0 && (
                  <p className="b2b-feeder-empty">No feeders match your search.</p>
                )}
              </div>
            </div>
            <div className="b2b-modal-footer">
              <button
                type="button"
                className="b2b-btn b2b-btn-secondary"
                onClick={closeFeederPicker}
              >
                Cancel
              </button>
              <button
                type="button"
                className="b2b-btn b2b-btn-primary"
                onClick={applyFeederPicker}
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
