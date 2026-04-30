import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import { authMutation } from '../../utils/authMutation';
import { REALTIME_MODULES } from '../../constants/realtimeModules';
import { toast } from 'react-toastify';
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import { validatePhilippineMobile, toDisplayFormat, INVALID_PHONE_HINT } from '../../utils/phoneUtils';
import '../../CSS/DispatchTicketModal.css';

/**
 * EditTicketModal - Edit ticket details (consumer info, location, category, concern).
 * Only for standalone tickets (not GROUP masters, not group children).
 */
const EditTicketModal = ({ isOpen, onClose, ticket, onSuccess }) => {
    const [formData, setFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        phone_number: '',
        account_number: '',
        address: '',
        district: '',
        municipality: '',
        category: '',
        concern: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && ticket) {
            setFormData({
                first_name: ticket.first_name || '',
                middle_name: ticket.middle_name || '',
                last_name: ticket.last_name || '',
                phone_number: ticket.phone_number || '',
                account_number: ticket.account_number || '',
                address: ticket.address || '',
                district: ticket.district || '',
                municipality: ticket.municipality || '',
                category: ticket.category || '',
                concern: ticket.concern || ''
            });
        }
    }, [isOpen, ticket]);

    if (!isOpen || !ticket) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLocationSelect = (locObj) => {
        if (locObj && locObj.district && locObj.municipality) {
            setFormData(prev => ({
                ...prev,
                district: locObj.district,
                municipality: locObj.municipality
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.first_name?.trim() || !formData.last_name?.trim() || !formData.phone_number?.trim() || !formData.category?.trim() || !formData.concern?.trim()) {
            toast.error('First name, last name, phone, category, and concern are required.');
            return;
        }
        const phoneCheck = validatePhilippineMobile(formData.phone_number);
        if (!phoneCheck.valid) {
            toast.error(phoneCheck.error || INVALID_PHONE_HINT);
            return;
        }
        if (formData.district && !formData.municipality) {
            toast.error('Please select a municipality when district is set.');
            return;
        }
        if (formData.municipality && !formData.district) {
            toast.error('Please select a district when municipality is set.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await authMutation(apiUrl(`/api/tickets/${ticket.ticket_id}`), {
                method: 'PUT',
                body: {
                ...formData,
                actor_email: localStorage.getItem('userEmail') || null,
                actor_name: localStorage.getItem('userName') || null
                },
                emitRealtime: { module: REALTIME_MODULES.TICKETS },
            });
            const data = result.data || {};

            if (result.ok && data.success) {
                toast.success(`Ticket ${ticket.ticket_id} updated.`);
                onSuccess?.();
                onClose();
            } else {
                toast.error(data.message || 'Failed to update ticket.');
            }
        } catch (err) {
            console.error('Edit ticket error:', err);
            toast.error('Failed to update ticket. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content edit-ticket-modal" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="edit-ticket-header">
                    <h2 className="edit-ticket-title">Edit Ticket</h2>
                    <p className="edit-ticket-subtitle">
                        Ticket <span className="highlight-id">{ticket.ticket_id}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="edit-ticket-form">
                    <div className="edit-ticket-form-body">
                        <div className="edit-ticket-grid">
                    <div className="dispatch-form-group">
                        <label>First Name</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            value={formData.first_name}
                            onChange={(e) => handleChange('first_name', e.target.value)}
                            required
                        />
                    </div>
                    <div className="dispatch-form-group">
                        <label>Last Name</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            value={formData.last_name}
                            onChange={(e) => handleChange('last_name', e.target.value)}
                            required
                        />
                    </div>
                    <div className="dispatch-form-group edit-ticket-full-width">
                        <label>Middle Name</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            value={formData.middle_name}
                            onChange={(e) => handleChange('middle_name', e.target.value)}
                        />
                    </div>
                    <div className="dispatch-form-group">
                        <label>Phone Number</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            placeholder="09XXXXXXXXX"
                            value={formData.phone_number}
                            onChange={(e) => handleChange('phone_number', e.target.value)}
                            required
                        />
                    </div>
                    <div className="dispatch-form-group">
                        <label>Account Number</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            value={formData.account_number}
                            onChange={(e) => handleChange('account_number', e.target.value)}
                        />
                    </div>
                    <div className="dispatch-form-group edit-ticket-full-width">
                        <label>Address</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                        />
                    </div>
                    <div className="dispatch-form-group edit-ticket-full-width">
                        <label>District & Municipality</label>
                        <AlecoScopeDropdown
                            onLocationSelect={handleLocationSelect}
                            initialDistrict={formData.district}
                            initialMunicipality={formData.municipality}
                        />
                    </div>
                    <div className="dispatch-form-group edit-ticket-full-width">
                        <label>Issue Category</label>
                        <IssueCategoryDropdown
                            value={formData.category}
                            onChange={(v) => handleChange('category', v)}
                            isFilter={false}
                        />
                    </div>
                    <div className="dispatch-form-group edit-ticket-full-width">
                        <label>Concern / Description</label>
                        <textarea
                            className="dispatch-form-textarea edit-ticket-textarea"
                            rows={4}
                            value={formData.concern}
                            onChange={(e) => handleChange('concern', e.target.value)}
                            required
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

export default EditTicketModal;
