import React from 'react';
import '../../CSS/PersonnelLayoutPicker.css';

/**
 * PersonnelLayoutPicker - Lego Brick for switching Crew/Linemen view modes
 * Data Management parity: Card, Compact, Workflow
 * No Map option (personnel have no geographic data)
 */
const PersonnelLayoutPicker = ({ activeLayout, onLayoutChange }) => {
    const layouts = [
        { id: 'card', icon: '▦', label: 'Card', tooltip: 'Card view for visual scanning' },
        { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Compact rows for bulk operations' },
        { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Grouped by status columns' }
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

export default PersonnelLayoutPicker;
