import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import '../../CSS/DispatchTicketModal.css';

/**
 * EditGroupDetailsModal - Edit a GROUP master's display metadata only.
 *
 * Field mapping (matches how TicketDetailPane renders a GROUP master):
 *   title   -> ticket.address  ("Group Title")
 *   summary -> ticket.concern  ("Summary / Remarks")
 *   category-> ticket.category
 *
 * Only usable for Pending groups (parent gates visibility). The actual mutation
 * is delegated to `onSubmit(mainTicketId, fields)` which performs the PATCH and
 * returns { success, conflict? }.
 */
const EditGroupDetailsModal = ({ isOpen, onClose, group, onSubmit }) => {
    const [form, setForm] = useState({ title: '', category: '', summary: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && group) {
            setForm({
                title: group.address || '',
                category: group.category || '',
                summary: group.concern || '',
            });
        }
    }, [isOpen, group]);

    if (!isOpen || !group) return null;

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast.error('Group title is required.');
            return;
        }
        if (!form.category.trim()) {
            toast.error('Category is required.');
            return;
        }

        // Only send fields that actually changed to keep the audit log meaningful.
        const fields = {};
        if (form.title.trim() !== (group.address || '')) fields.title = form.title.trim();
        if (form.category.trim() !== (group.category || '')) fields.category = form.category.trim();
        if (form.summary.trim() !== (group.concern || '').trim()) fields.summary = form.summary.trim();

        if (Object.keys(fields).length === 0) {
            toast.info('No changes to save.');
            onClose();
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await onSubmit?.(group.ticket_id, fields);
            if (result?.success) {
                onClose();
            }
            // On conflict/failure the parent already surfaced a toast + refetch.
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content edit-ticket-modal" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="edit-ticket-header">
                    <h2 className="edit-ticket-title">Edit Group Details</h2>
                    <p className="edit-ticket-subtitle">
                        Group <span className="highlight-id">{group.ticket_id}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="edit-ticket-form">
                    <div className="edit-ticket-form-body">
                        <div className="edit-ticket-grid">
                            <div className="dispatch-form-group edit-ticket-full-width">
                                <label>Group Title</label>
                                <input
                                    type="text"
                                    className="dispatch-form-input"
                                    value={form.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    placeholder="e.g., Power Outage - Brgy. San Jose"
                                    required
                                />
                            </div>
                            <div className="dispatch-form-group edit-ticket-full-width">
                                <label>Issue Category</label>
                                <IssueCategoryDropdown
                                    value={form.category}
                                    onChange={(v) => handleChange('category', v)}
                                    isFilter={false}
                                />
                            </div>
                            <div className="dispatch-form-group edit-ticket-full-width">
                                <label>Summary / Remarks</label>
                                <textarea
                                    className="dispatch-form-textarea edit-ticket-textarea"
                                    rows={4}
                                    value={form.summary}
                                    onChange={(e) => handleChange('summary', e.target.value)}
                                    placeholder="Short description of the grouped incident..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="edit-ticket-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-action btn-ongoing" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditGroupDetailsModal;
