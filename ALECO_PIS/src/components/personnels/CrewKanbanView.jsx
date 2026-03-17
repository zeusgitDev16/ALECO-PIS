import React, { useMemo } from 'react';
import { groupCrewsByStatus, getCrewColumnConfig } from '../../utils/personnelKanbanHelpers';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelKanban.css';

/**
 * CrewKanbanView - Lego Brick: Kanban columns by status (Available, Deployed, Offline)
 * View-only (no drag) - Edit via button
 */
const CrewKanbanView = ({ crews, isLoading, onEditCrew }) => {
    const grouped = useMemo(() => groupCrewsByStatus(crews), [crews]);
    const columnConfig = getCrewColumnConfig();

    if (isLoading) {
        return (
            <div className="personnel-kanban-wrapper">
                <p className="personnel-loading">Loading crews...</p>
            </div>
        );
    }

    const columns = ['available', 'deployed', 'offline'];

    return (
        <div className="personnel-kanban-wrapper">
            <div className="personnel-kanban-board">
                {columns.map(colId => {
                    const config = columnConfig[colId];
                    const items = grouped[colId] || [];
                    return (
                        <div
                            key={colId}
                            className="personnel-kanban-column"
                            style={{ borderTopColor: config.color }}
                        >
                            <div className="personnel-kanban-column-header">
                                <span className="personnel-kanban-column-icon">{config.icon}</span>
                                <h3 className="personnel-kanban-column-title">{config.title}</h3>
                                <span className="personnel-kanban-count" style={{ backgroundColor: config.color }}>
                                    {items.length}
                                </span>
                            </div>
                            <div className="personnel-kanban-column-body">
                                {items.length === 0 ? (
                                    <div className="personnel-kanban-empty">No crews</div>
                                ) : (
                                    items.map(crew => (
                                        <div
                                            key={crew.id}
                                            className="personnel-kanban-card"
                                            onClick={() => onEditCrew && onEditCrew(crew)}
                                        >
                                            <div className="personnel-kanban-card-title">{crew.crew_name}</div>
                                            <div className="personnel-kanban-card-lead">{crew.lead_lineman_name || 'Unassigned'}</div>
                                            <div className="personnel-kanban-card-meta">
                                                {crew.members?.length || 0} members · <span className="phone-display">{formatPhoneDisplay(crew.phone_number) || toDisplayFormat(crew.phone_number) || '—'}</span>
                                            </div>
                                            <button
                                                className="personnel-kanban-card-btn"
                                                onClick={(e) => { e.stopPropagation(); onEditCrew && onEditCrew(crew); }}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CrewKanbanView;
