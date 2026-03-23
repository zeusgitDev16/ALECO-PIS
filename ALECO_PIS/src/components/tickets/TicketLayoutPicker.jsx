import React from 'react';
import '../../CSS/TicketLayoutPicker.css';

const TicketLayoutPicker = ({ activeLayout, onLayoutChange, filterButton }) => {
    const layouts = [
        { id: 'card', icon: '▦', label: 'Card', tooltip: 'Card view for visual scanning' },
        { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Compact rows for bulk operations' },
        { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Workflow columns by status' },
        { id: 'map', icon: '🗺️', label: 'Map', tooltip: 'Geographic coverage view' }
    ];

    return (
        <div className="layout-picker-container">
            <div className="layout-buttons">
                {layouts.map(layout => (
                    <button
                        key={layout.id}
                        className={`layout-btn ${activeLayout === layout.id ? 'active' : ''}`}
                        onClick={() => onLayoutChange(layout.id)}
                        title={layout.tooltip}
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

export default TicketLayoutPicker;


