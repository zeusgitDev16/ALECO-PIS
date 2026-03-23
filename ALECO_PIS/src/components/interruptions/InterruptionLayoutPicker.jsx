import React from 'react';
import '../../CSS/InterruptionLayoutPicker.css';

/**
 * InterruptionLayoutPicker - Layout toggle for Power Advisories dashboard
 * Data Management parity: Card, Compact, Workflow
 */
const InterruptionLayoutPicker = ({ activeLayout, onLayoutChange, filterButton }) => {
    const layouts = [
        { id: 'card', icon: '▦', label: 'Card', tooltip: 'Card view for visual scanning' },
        { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Compact rows for bulk operations' },
        { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Grouped by status columns' }
    ];

    return (
        <div className="interruption-layout-picker">
            <div className="interruption-layout-buttons">
                {layouts.map(layout => (
                    <button
                        key={layout.id}
                        className={`interruption-layout-btn ${activeLayout === layout.id ? 'active' : ''}`}
                        onClick={() => onLayoutChange(layout.id)}
                        title={layout.tooltip}
                        aria-label={`Switch to ${layout.label} layout`}
                    >
                        <span className="interruption-layout-icon">{layout.icon}</span>
                        <span className="interruption-layout-label">{layout.label}</span>
                    </button>
                ))}
            </div>
            {filterButton}
        </div>
    );
};

export default InterruptionLayoutPicker;
