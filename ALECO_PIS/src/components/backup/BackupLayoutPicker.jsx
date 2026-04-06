import React from 'react';
import '../../CSS/BackupLayoutPicker.css';

const BackupLayoutPicker = ({ activeLayout, onLayoutChange, filterButton }) => {
    const layouts = [
        { id: 'card', icon: '▦', label: 'Card', tooltip: 'Feature cards in a grid' },
        { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Single panel with tabs' },
        { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Step-by-step flow' }
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
                        aria-label={`Switch to ${layout.label} layout`}
                    >
                        <span className="layout-icon">{layout.icon}</span>
                        <span className="layout-label">{layout.label}</span>
                    </button>
                ))}
            </div>
            {filterButton}
        </div>
    );
};

export default BackupLayoutPicker;
