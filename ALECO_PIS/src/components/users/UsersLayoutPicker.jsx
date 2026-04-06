import React from 'react';
import '../../CSS/UsersLayoutPicker.css';

/**
 * Card / Compact / Workflow — parity with Tickets and Personnel (no Map).
 */
const UsersLayoutPicker = ({ activeLayout, onLayoutChange }) => {
  const layouts = [
    { id: 'card', icon: '▦', label: 'Card', tooltip: 'Card grid for scanning profiles' },
    { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Dense table for bulk review' },
    { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Columns by account status' }
  ];

  return (
    <div className="layout-picker-container">
      <div className="layout-buttons">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className={`layout-btn ${activeLayout === layout.id ? 'active' : ''}`}
            onClick={() => onLayoutChange(layout.id)}
            title={layout.tooltip}
          >
            <span className="layout-icon">{layout.icon}</span>
            <span className="layout-label">{layout.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default UsersLayoutPicker;
