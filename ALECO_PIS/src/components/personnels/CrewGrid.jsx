import React from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelGrid.css';

/**
 * CrewGrid - Lego Brick: Card view for crews
 */
const CrewGrid = ({ crews, isLoading, onEditCrew }) => {
    if (isLoading) {
        return (
            <div className="personnel-grid-wrapper">
                <p className="personnel-loading">Loading crews...</p>
            </div>
        );
    }

    if (!crews || crews.length === 0) {
        return (
            <div className="personnel-grid-wrapper">
                <p className="personnel-empty">No crews found.</p>
            </div>
        );
    }

    return (
        <div className="personnel-grid-wrapper">
            <div className="personnel-card-grid">
                {crews.map(crew => (
                    <div
                        key={crew.id}
                        className="personnel-card personnel-card-crew"
                        onClick={() => onEditCrew && onEditCrew(crew)}
                    >
                        <div className="personnel-card-banner">
                            <span className="personnel-card-banner-text">
                                {crew.status || 'Available'}
                            </span>
                        </div>
                        <div className="personnel-card-header">
                            <span className="personnel-card-title">{crew.crew_name}</span>
                            <span className="personnel-card-lead">
                                {crew.lead_lineman_name || 'Unassigned'}
                            </span>
                        </div>
                        <div className="personnel-card-body">
                            <span className="personnel-card-meta">
                                👷 {crew.members?.length || 0} Members
                            </span>
                            <span className="personnel-card-phone phone-display">
                                {formatPhoneDisplay(crew.phone_number) || toDisplayFormat(crew.phone_number) || crew.phone_number || '—'}
                            </span>
                        </div>
                        <button
                            className="personnel-card-action"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditCrew && onEditCrew(crew);
                            }}
                        >
                            Edit
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CrewGrid;
