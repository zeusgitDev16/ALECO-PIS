import React from 'react';
import '../../CSS/TicketLayoutPicker.css';

const TicketLayoutPicker = ({ activeLayout, onLayoutChange }) => {
    const layouts = [
        { id: 'grid', icon: '▦', label: 'Grid', tooltip: 'Card view for visual scanning' },
        { id: 'table', icon: '☰', label: 'Table', tooltip: 'Compact rows for bulk operations' },
        { id: 'kanban', icon: '▥', label: 'Kanban', tooltip: 'Drag-and-drop workflow columns by status' },
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
        </div>
    );
};

export default TicketLayoutPicker;


