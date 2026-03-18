import React, { useEffect } from 'react';
import '../../CSS/FilterModal.css';

const FilterModal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="filter-modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-modal-title"
        >
            <div
                className="filter-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="filter-modal-header">
                    <h3 id="filter-modal-title" className="filter-modal-title">{title}</h3>
                    <button
                        type="button"
                        className="filter-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="filter-modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default FilterModal;
