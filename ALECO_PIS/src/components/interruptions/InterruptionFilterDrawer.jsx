import React, { useEffect } from 'react';
import '../../CSS/TicketFilterDrawer.css';

const InterruptionFilterDrawer = ({ isOpen, onClose, children }) => {
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
      className="ticket-filter-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Advisory filters"
    >
      <div
        className="ticket-filter-drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ticket-filter-drawer-header">
          <h3 className="ticket-filter-drawer-title">Filters</h3>
          <button
            type="button"
            className="ticket-filter-drawer-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>
        <div className="ticket-filter-drawer-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InterruptionFilterDrawer;
