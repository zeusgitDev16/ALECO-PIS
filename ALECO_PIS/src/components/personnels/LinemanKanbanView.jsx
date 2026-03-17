import React, { useMemo } from 'react';
import { groupLinemenByStatus, getLinemanColumnConfig } from '../../utils/personnelKanbanHelpers';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelKanban.css';

/**
 * LinemanKanbanView - Lego Brick: Kanban columns by status (Active, Inactive)
 * View-only (no drag) - Edit via button
 */
const LinemanKanbanView = ({ linemen, isLoading, onEditLineman }) => {
    const grouped = useMemo(() => groupLinemenByStatus(linemen), [linemen]);
    const columnConfig = getLinemanColumnConfig();

    if (isLoading) {
        return (
            <div className="personnel-kanban-wrapper">
                <p className="personnel-loading">Loading linemen...</p>
            </div>
        );
    }

    const columns = ['active', 'leave', 'inactive'];

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
                                    <div className="personnel-kanban-empty">No linemen</div>
                                ) : (
                                    items.map(man => (
                                        <div
                                            key={man.id}
                                            className="personnel-kanban-card"
                                            onClick={() => onEditLineman && onEditLineman(man)}
                                        >
                                            <div className="personnel-kanban-card-title">{man.full_name}</div>
                                            <div className="personnel-kanban-card-lead">{man.designation || 'Lineman'}</div>
                                            <div className="personnel-kanban-card-meta">
                                                <span className="phone-display">{formatPhoneDisplay(man.contact_no) || toDisplayFormat(man.contact_no) || '—'}</span>
                                            </div>
                                            <button
                                                className="personnel-kanban-card-btn"
                                                onClick={(e) => { e.stopPropagation(); onEditLineman && onEditLineman(man); }}
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

export default LinemanKanbanView;
