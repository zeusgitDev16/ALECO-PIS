import React from 'react';
import { DATA_MANAGEMENT_ENTITIES } from '../../constants/dataManagementEntities';
import '../../CSS/EntityPicker.css';

const EntityPicker = ({ activeEntity, onEntityChange }) => {
    const handleClick = (entity) => {
        onEntityChange(entity.id);
        localStorage.setItem('dataManagementEntity', entity.id);
    };

    return (
        <div className="entity-picker">
            <div className="entity-picker-buttons">
                {DATA_MANAGEMENT_ENTITIES.map(entity => (
                    <button
                        key={entity.id}
                        type="button"
                        className={`entity-picker-btn ${activeEntity === entity.id ? 'active' : ''} ${!entity.available ? 'coming-soon' : ''}`}
                        onClick={() => handleClick(entity)}
                        title={entity.available ? `Export, import, and archive ${entity.label}` : 'Coming soon'}
                        aria-label={`Select ${entity.label}${entity.available ? '' : ' (coming soon)'}`}
                    >
                        <span className="entity-picker-icon" aria-hidden="true">{entity.icon}</span>
                        <span className="entity-picker-label">{entity.label}</span>
                        {!entity.available && <span className="coming-soon-badge">Soon</span>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EntityPicker;
