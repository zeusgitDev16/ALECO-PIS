import React, { useEffect, useRef } from 'react';
import '../../CSS/B2BFilterLayout.css';

const B2BFilterDrawer = ({ isOpen, onClose, children }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const trapTab = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', trapTab);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', trapTab);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const firstFocusable = panelRef.current.querySelector(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) firstFocusable.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="b2b-filter-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="B2B filters"
    >
      <div
        className="b2b-filter-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
      >
        <div className="b2b-filter-drawer-header">
          <h3 className="b2b-filter-drawer-title">Filters</h3>
          <button
            type="button"
            className="b2b-filter-drawer-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            ×
          </button>
        </div>
        <div className="b2b-filter-drawer-content">{children}</div>
      </div>
    </div>
  );
};

export default B2BFilterDrawer;
