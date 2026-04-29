import React from 'react';
import { DATA_MANAGEMENT_ENTITIES } from '../../constants/dataManagementEntities';
import '../../CSS/EntityPicker.css';

const EntityPicker = ({ activeEntity, onEntityChange, entities }) => {
    const renderEntities = Array.isArray(entities) && entities.length > 0
        ? entities
        : DATA_MANAGEMENT_ENTITIES;

    const handleClick = (entity) => {
        onEntityChange(entity.id);
        localStorage.setItem('dataManagementEntity', entity.id);
    };

    return (
        <div className="entity-picker">
            <div className="entity-picker-buttons">
                {renderEntities.map(entity => (
                    <button
                        key={entity.id}
                        type="button"
                        className={`entity-picker-btn ${activeEntity === entity.id ? 'active' : ''} ${!entity.available ? 'coming-soon' : ''}`}
                        onClick={() => handleClick(entity)}
                        title={
                            entity.available
                                ? (entity.id === 'history'
                                    ? `Export ${entity.label}`
                                    : `Export, import, and archive ${entity.label}`)
                                : 'Coming soon'
                        }
                        aria-label={
                            entity.available
                                ? (entity.id === 'history'
                                    ? `Select ${entity.label} export`
                                    : `Select ${entity.label}`)
                                : `Select ${entity.label} (coming soon)`
                        }
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
