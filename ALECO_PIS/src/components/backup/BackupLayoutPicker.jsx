import React from 'react';
import '../../CSS/BackupLayoutPicker.css';

const BackupLayoutPicker = ({ activeLayout, onLayoutChange }) => {
    const layouts = [
        { id: 'compact', icon: '≡', label: 'Compact', tooltip: 'Single panel with tabs' },
        { id: 'cards', icon: '▦', label: 'Cards', tooltip: 'Feature cards in a grid' },
        { id: 'workflow', icon: '⇣', label: 'Workflow', tooltip: 'Step-by-step flow' }
    ];

    return (
        <div className="backup-layout-picker">
            <div className="backup-layout-buttons">
                {layouts.map(layout => (
                    <button
                        key={layout.id}
                        className={`backup-layout-btn ${activeLayout === layout.id ? 'active' : ''}`}
                        onClick={() => onLayoutChange(layout.id)}
                        title={layout.tooltip}
                        aria-label={`Switch to ${layout.label} layout`}
                    >
                        <span className="backup-layout-icon">{layout.icon}</span>
                        <span className="backup-layout-label">{layout.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BackupLayoutPicker;
