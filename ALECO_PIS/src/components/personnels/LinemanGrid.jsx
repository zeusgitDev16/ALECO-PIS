import React from 'react';
import PersonnelCompactCard from './PersonnelCompactCard';
import '../../CSS/PersonnelGrid.css';

/**
 * Linemen pool card grid — Interruptions-style compact cards.
 */
const LinemanGrid = ({
  linemen,
  isLoading,
  saving,
  onViewDetail,
  onEditLineman,
  onDeleteLineman,
  onOpenAction,
  isMobile,
}) => {
  if (isLoading && (!linemen || linemen.length === 0)) {
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
      <div className="interruptions-admin-card-grid personnel-admin-card-grid">
        {linemen.map((man) => (
          <PersonnelCompactCard
            key={man.id}
            variant="lineman"
            lineman={man}
            onExpand={() => onViewDetail(man)}
            onEdit={() => onEditLineman(man)}
            onDelete={() => onDeleteLineman(man)}
            onCardClick={isMobile && onOpenAction ? (row) => onOpenAction(row) : undefined}
            saving={saving}
          />
        ))}
      </div>
    </div>
  );
};

export default LinemanGrid;
