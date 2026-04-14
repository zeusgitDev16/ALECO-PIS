import React from 'react';
import PersonnelCompactCard from './PersonnelCompactCard';
import '../../CSS/PersonnelGrid.css';

/**
 * Crew card grid — Interruptions-style compact cards (PersonnelCompactCard).
 */
const CrewGrid = ({
  crews,
  isLoading,
  saving,
  onViewDetail,
  onEditCrew,
  onDeleteCrew,
  onOpenAction,
  isMobile,
}) => {
  if (isLoading && (!crews || crews.length === 0)) {
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
      <div className="interruptions-admin-card-grid personnel-admin-card-grid">
        {crews.map((crew) => (
          <PersonnelCompactCard
            key={crew.id}
            variant="crew"
            crew={crew}
            onExpand={() => onViewDetail(crew)}
            onEdit={() => onEditCrew(crew)}
            onDelete={() => onDeleteCrew(crew)}
            onCardClick={isMobile && onOpenAction ? (row) => onOpenAction(row) : undefined}
            saving={saving}
          />
        ))}
      </div>
    </div>
  );
};

export default CrewGrid;
