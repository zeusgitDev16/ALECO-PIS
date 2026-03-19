import React from 'react';
import '../../CSS/DispatchTicketModal.css';

/**
 * ConfirmModal - Reusable confirmation dialog (replaces window.confirm).
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {function} onConfirm - Called when user confirms
 * @param {string} title
 * @param {string} message
 * @param {string} confirmLabel - e.g. "Confirm", "Delete"
 * @param {string} cancelLabel - e.g. "Cancel"
 * @param {string} variant - 'danger' | 'default' | 'success' - affects confirm button style
 */
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default' }) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm?.();
        onClose?.();
    };

    return (
        <div className="dispatch-modal-overlay confirm-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">{title}</h2>
                    <p className="dispatch-modal-subtitle">{message}</p>
                </div>

                <div className="dispatch-modal-actions">
                    <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn-action ${variant === 'danger' ? 'btn-delete' : variant === 'success' ? 'btn-resolved' : 'btn-ongoing'}`}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
