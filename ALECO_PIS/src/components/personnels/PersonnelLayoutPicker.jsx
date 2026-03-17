import React from 'react';
import '../../CSS/PersonnelLayoutPicker.css';

/**
 * PersonnelLayoutPicker - Lego Brick for switching Crew/Linemen view modes
 * Mirrors TicketLayoutPicker UX: Grid, Table, Kanban
 * No Map option (personnel have no geographic data)
 */
const PersonnelLayoutPicker = ({ activeLayout, onLayoutChange }) => {
    const layouts = [
        { id: 'grid', icon: '▦', label: 'Grid', tooltip: 'Card view for visual scanning' },
        { id: 'table', icon: '☰', label: 'Table', tooltip: 'Compact rows for bulk operations' },
        { id: 'kanban', icon: '▥', label: 'Kanban', tooltip: 'Grouped by status columns' }
    ];

    return (
        <div className="layout-picker-container personnel-layout-picker">
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

export default PersonnelLayoutPicker;
