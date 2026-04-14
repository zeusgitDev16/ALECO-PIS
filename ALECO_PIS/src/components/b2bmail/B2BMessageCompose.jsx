import React, { useState, useEffect } from 'react';

const TARGET_MODES = [
  { key: 'all_feeders', label: 'All Feeders', desc: 'Send to all active contacts' },
  { key: 'selected_feeders', label: 'Selected Feeders', desc: 'Choose specific feeders' },
  { key: 'manual_contacts', label: 'Manual Contacts', desc: 'Select individual contacts' },
];

/**
 * Message compose modal
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(data: object) => Promise<void>} props.onSend
 * @param {(data: object) => Promise<void>} props.onSaveDraft
 * @param {() => Promise<void>} props.onPreviewRecipients
 * @param {object} props.previewResult - { count, sample }
 * @param {Array} props.contacts - Verified contacts
 * @param {Array} props.feederOptions
 * @param {Array} props.templates
 * @param {boolean} props.saving
 */
export default function B2BMessageCompose({
  isOpen,
  onClose,
  onSend,
  onSaveDraft,
  onPreviewRecipients,
  previewResult,
  contacts,
  feederOptions,
  templates,
  saving,
}) {
  const [formData, setFormData] = useState({
    targetMode: 'all_feeders',
    selectedFeederIds: [],
    selectedContactIds: [],
    templateId: '',
    subject: '',
    bodyText: '',
  });
  const [errors, setErrors] = useState([]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setFormData({
        targetMode: 'all_feeders',
        selectedFeederIds: [],
        selectedContactIds: [],
        templateId: '',
        subject: '',
        bodyText: '',
      });
      setErrors([]);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, saving, onClose]);

  const activeContactCount = contacts.filter(
    (c) => (c.is_active === 1 || c.is_active === true) && 
           (c.email_verified === 1 || c.email_verified === true)
  ).length;

  const validate = () => {
    const errs = [];
    if (!formData.subject.trim() && !formData.bodyText.trim()) {
      errs.push('Please enter a subject or message body');
    }
    if (formData.targetMode === 'selected_feeders' && formData.selectedFeederIds.length === 0) {
      errs.push('Please select at least one feeder');
    }
    if (formData.targetMode === 'manual_contacts' && formData.selectedContactIds.length === 0) {
      errs.push('Please select at least one contact');
    }
    if (formData.targetMode === 'all_feeders' && activeContactCount === 0) {
      errs.push('No active contacts available. Please add and verify contacts first.');
    }
    return errs;
  };

  const handleSend = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    await onSend(formData);
    onClose();
  };

  const handleSaveDraft = async () => {
    await onSaveDraft(formData);
    onClose();
  };

  const handlePreview = async () => {
    setErrors([]);
    await onPreviewRecipients(formData);
  };

  const handleTemplateChange = (templateId) => {
    const id = templateId ? Number(templateId) : null;
    const tpl = templates.find((t) => Number(t.id) === id);
    setFormData((p) => ({
      ...p,
      templateId: id,
      subject: tpl ? tpl.subject || p.subject : p.subject,
      bodyText: tpl ? tpl.body_text || p.bodyText : p.bodyText,
    }));
  };

  if (!isOpen) return null;

  const verifiedContacts = contacts.filter(
    (c) => c.email_verified === 1 || c.email_verified === true
  );

  return (
    <div className="b2b-modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="b2b-modal b2b-compose-modal">
        <div className="b2b-modal-header">
          <h3>New Message</h3>
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

        <div className="b2b-modal-body">
          {errors.length > 0 && (
            <div className="b2b-form-errors">
              {errors.map((err, i) => (
                <div key={i} className="b2b-error">{err}</div>
              ))}
            </div>
          )}

          <label className="b2b-form-field">
            <span>Target Audience</span>
            <select
              value={formData.targetMode}
              onChange={(e) => setFormData((p) => ({ ...p, targetMode: e.target.value }))}
              disabled={saving}
            >
              {TARGET_MODES.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <small className="b2b-form-hint">
              {TARGET_MODES.find((m) => m.key === formData.targetMode)?.desc}
            </small>
          </label>

          {formData.targetMode === 'all_feeders' && (
            <div className="b2b-all-feeders-info">
              <div className="b2b-info-card">
                <span className="b2b-info-icon">📧</span>
                <div className="b2b-info-content">
                  <strong className="b2b-info-title">All Active Contacts</strong>
                  <span className="b2b-info-desc">Message will be sent to {activeContactCount} verified contacts across all feeders</span>
                </div>
              </div>
            </div>
          )}

          {formData.targetMode === 'selected_feeders' && (
            <label className="b2b-form-field">
              <span>Select Feeders</span>
              <div className="b2b-feeder-checkbox-list">
                <div className="b2b-feeder-table-header">
                  <label className="b2b-select-all">
                    <input
                      type="checkbox"
                      checked={feederOptions.length > 0 && formData.selectedFeederIds.length === feederOptions.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((p) => ({ ...p, selectedFeederIds: feederOptions.map((f) => f.id) }));
                        } else {
                          setFormData((p) => ({ ...p, selectedFeederIds: [] }));
                        }
                      }}
                      disabled={saving}
                    />
                    <span>Select All ({feederOptions.length})</span>
                  </label>
                </div>
                <div className="b2b-feeder-list-wrap">
                  {feederOptions.map((feeder) => (
                    <div
                      key={feeder.id}
                      className={`b2b-feeder-row${formData.selectedFeederIds.includes(feeder.id) ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedFeederIds.includes(feeder.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((p) => ({ ...p, selectedFeederIds: [...p.selectedFeederIds, feeder.id] }));
                          } else {
                            setFormData((p) => ({ ...p, selectedFeederIds: p.selectedFeederIds.filter((id) => id !== feeder.id) }));
                          }
                        }}
                        disabled={saving}
                      />
                      <span className="b2b-feeder-label">{feeder.label}</span>
                    </div>
                  ))}
                  {feederOptions.length === 0 && (
                    <div className="b2b-feeder-empty">No feeders available</div>
                  )}
                </div>
              </div>
            </label>
          )}

          {formData.targetMode === 'manual_contacts' && (
            <label className="b2b-form-field">
              <span>Select Contacts</span>
              <div className="b2b-contact-checkbox-list">
                <div className="b2b-contact-table-header">
                  <label className="b2b-select-all">
                    <input
                      type="checkbox"
                      checked={verifiedContacts.length > 0 && formData.selectedContactIds.length === verifiedContacts.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((p) => ({ ...p, selectedContactIds: verifiedContacts.map((c) => c.id) }));
                        } else {
                          setFormData((p) => ({ ...p, selectedContactIds: [] }));
                        }
                      }}
                      disabled={saving}
                    />
                    <span>Select All ({verifiedContacts.length})</span>
                  </label>
                </div>
                <div className="b2b-contact-list-wrap">
                  {verifiedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`b2b-contact-row${formData.selectedContactIds.includes(contact.id) ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedContactIds.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((p) => ({ ...p, selectedContactIds: [...p.selectedContactIds, contact.id] }));
                          } else {
                            setFormData((p) => ({ ...p, selectedContactIds: p.selectedContactIds.filter((id) => id !== contact.id) }));
                          }
                        }}
                        disabled={saving}
                      />
                      <div className="b2b-contact-info">
                        <span className="b2b-contact-name">{contact.contact_name || '-'}</span>
                        <span className="b2b-contact-email">{contact.email}</span>
                      </div>
                    </div>
                  ))}
                  {verifiedContacts.length === 0 && (
                    <div className="b2b-contact-empty">No verified contacts available</div>
                  )}
                </div>
              </div>
            </label>
          )}


          <label className="b2b-form-field">
            <span>Template (optional)</span>
            <select
              value={formData.templateId || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={saving}
            >
              <option value="">None</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label className="b2b-form-field">
            <span>Subject</span>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Email subject..."
              disabled={saving}
            />
          </label>

          <label className="b2b-form-field">
            <span>Message</span>
            <textarea
              value={formData.bodyText}
              onChange={(e) => setFormData((p) => ({ ...p, bodyText: e.target.value }))}
              placeholder="Type your message..."
              rows={8}
              disabled={saving}
            />
          </label>

          <div className="b2b-preview-section">
            <button
              type="button"
              className="b2b-btn b2b-btn-ghost"
              onClick={handlePreview}
              disabled={saving}
            >
              Preview Recipients
            </button>
            {previewResult && (
              <div className="b2b-preview-result">
                <strong>Recipients: {previewResult.count}</strong>
                {previewResult.sample?.length > 0 && (
                  <ul className="b2b-preview-list">
                    {previewResult.sample.slice(0, 5).map((s, i) => (
                      <li key={i}>{s.name ? `${s.name} · ` : ''}{s.email}</li>
                    ))}
                    {previewResult.sample.length > 5 && (
                      <li>...and {previewResult.sample.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="b2b-modal-footer">
          <button
            type="button"
            className="b2b-btn b2b-btn-secondary"
            onClick={handleSaveDraft}
            disabled={saving}
          >
            Save Draft
          </button>
          <button
            type="button"
            className="b2b-btn b2b-btn-primary"
            onClick={handleSend}
            disabled={saving}
          >
            {saving ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
