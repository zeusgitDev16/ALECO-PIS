import React from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelGrid.css';

/**
 * LinemanGrid - Lego Brick: Card view for linemen
 */
const LinemanGrid = ({ linemen, isLoading, onEditLineman }) => {
    if (isLoading) {
        return (
            <div className="personnel-grid-wrapper">
                <p className="personnel-loading">Loading linemen...</p>
            </div>
        );
    }

    if (!linemen || linemen.length === 0) {
        return (
            <div className="personnel-grid-wrapper">
                <p className="personnel-empty">No linemen found in the pool.</p>
            </div>
        );
    }

    return (
        <div className="personnel-grid-wrapper">
            <div className="personnel-card-grid">
                {linemen.map(man => (
                    <div
                        key={man.id}
                        className="personnel-card personnel-card-lineman"
                        onClick={() => onEditLineman && onEditLineman(man)}
                    >
                        <div className="personnel-card-banner">
                            <span className="personnel-card-banner-text">
                                {man.status || 'Active'}
                            </span>
                        </div>
                        <div className="personnel-card-header">
                            <span className="personnel-card-title">{man.full_name}</span>
                            <span className="personnel-card-lead">{man.designation || 'Lineman'}</span>
                        </div>
                        <div className="personnel-card-body">
                            <span className="personnel-card-phone phone-display">
                                {formatPhoneDisplay(man.contact_no) || toDisplayFormat(man.contact_no) || man.contact_no || '—'}
                            </span>
                        </div>
                        <button
                            className="personnel-card-action"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditLineman && onEditLineman(man);
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

export default LinemanGrid;
