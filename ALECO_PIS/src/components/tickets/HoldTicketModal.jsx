import React, { useState } from 'react';
import '../../CSS/DispatchTicketModal.css';

/**
 * HoldTicketModal - Dispatcher puts Ongoing ticket on hold with reason and optional consumer notification.
 */
const HoldTicketModal = ({ isOpen, onClose, ticket, onSubmit }) => {
    const [holdReason, setHoldReason] = useState('');
    const [notifyConsumer, setNotifyConsumer] = useState(true);

    if (!isOpen || !ticket) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!holdReason.trim()) return;
        onSubmit({ hold_reason: holdReason.trim(), notify_consumer: notifyConsumer });
        setHoldReason('');
        setNotifyConsumer(true);
    };

    const handleClose = () => {
        setHoldReason('');
        setNotifyConsumer(true);
        onClose();
    };

    return (
        <div className="dispatch-modal-overlay" onClick={handleClose}>
            <div className="dispatch-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={handleClose} aria-label="Close">
                    &times;
                </button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">⏸ Put on Hold</h2>
                    <p className="dispatch-modal-subtitle">
                        Ticket <span className="highlight-id">{ticket.ticket_id}</span> — Temporarily pause work
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dispatch-form-group">
                        <label>Hold Reason (required)</label>
                        <input
                            type="text"
                            className="dispatch-form-input"
                            placeholder="e.g., Waiting for materials, Awaiting clearance..."
                            value={holdReason}
                            onChange={(e) => setHoldReason(e.target.value)}
                            required
                        />
                    </div>

                    <div className="dispatch-form-group toggle-group">
                        <label className="toggle-label">
                            <div className="toggle-text">
                                <span className="toggle-title">Notify Consumer</span>
                                <span className="toggle-desc">
                                    Send SMS update to {ticket.phone_number || 'the consumer'}
                                </span>
                            </div>
                            <div className="toggle-switch-wrapper">
                                <input
                                    type="checkbox"
                                    className="toggle-checkbox"
                                    checked={notifyConsumer}
                                    onChange={(e) => setNotifyConsumer(e.target.checked)}
                                />
                                <div className="toggle-switch"></div>
                            </div>
                        </label>
                    </div>

                    <div className="dispatch-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={handleClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-ongoing">
                            Confirm Hold
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HoldTicketModal;
