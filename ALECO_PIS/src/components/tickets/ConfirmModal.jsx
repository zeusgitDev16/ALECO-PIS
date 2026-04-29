import React, { useState, useEffect } from 'react';
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
 * @param {string} variant - 'danger' | 'default' | 'success' | 'hold' | 'unresolved' | 'nff' | 'access-denied' | 'ungroup' | 'revert-pending' - affects confirm button style
 * @param {string} [requireConfirmText] - When set, user must type this exact string before the confirm button is enabled
 */
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', requireConfirmText }) => {
    const [typed, setTyped] = useState('');

    useEffect(() => {
        if (!isOpen) setTyped('');
    }, [isOpen]);

    if (!isOpen) return null;

    const canConfirm = !requireConfirmText || typed === requireConfirmText;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirm?.();
        onClose?.();
    };

    const getConfirmClass = () => {
        const map = {
            danger: 'btn-delete',
            success: 'btn-resolved',
            hold: 'btn-hold',
            unresolved: 'btn-unresolved',
            nff: 'btn-nff',
            'access-denied': 'btn-access-denied',
            ungroup: 'btn-ungroup',
            'revert-pending': 'btn-revert-pending'
        };
        return map[variant] || 'btn-ongoing';
    };

    return (
        <div className="dispatch-modal-overlay confirm-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">{title}</h2>
                    <p className="dispatch-modal-subtitle">{message}</p>
                </div>

                {requireConfirmText && (
                    <div style={{ padding: '0 0 12px 0' }}>
                        <input
                            type="text"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                            placeholder={`Type "${requireConfirmText}" to confirm`}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                fontSize: '0.9rem',
                                border: `1.5px solid ${typed === requireConfirmText ? '#d32f2f' : '#ccc'}`,
                                borderRadius: '6px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                    </div>
                )}

                <div className="dispatch-modal-actions">
                    <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn-action ${getConfirmClass()}`}
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        style={!canConfirm ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
