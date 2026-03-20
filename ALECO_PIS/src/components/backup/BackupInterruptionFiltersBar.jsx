import React, { useState } from 'react';
import '../../CSS/Backup.css';

const BackupInterruptionFiltersBar = ({ filters, setFilters }) => {
    const [isExpanded, setIsExpanded] = useState(() => {
        const saved = localStorage.getItem('backupInterruptionFiltersExpanded');
        if (saved !== null) return saved === 'true';
        return false;
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const toggleArchived = () => {
        setFilters((prev) => ({ ...prev, includeArchived: !prev.includeArchived }));
    };

    const clearFilters = () => {
        setFilters({ type: '', status: '', includeArchived: false });
    };

    const activeCount = [
        filters.type,
        filters.status,
        filters.includeArchived,
    ].filter(Boolean).length;

    return (
        <div className="filter-layout-wrapper backup-filters-wrapper">
            <button
                className="filter-toggle-btn"
                onClick={() => {
                    const next = !isExpanded;
                    setIsExpanded(next);
                    localStorage.setItem('backupInterruptionFiltersExpanded', String(next));
                }}
                aria-label={isExpanded ? 'Hide filters' : 'Show filters'}
            >
                <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
                <span className="toggle-text">
                    {isExpanded ? 'Hide Filters' : 'Show Filters'}
                </span>
                {!isExpanded && activeCount > 0 && (
                    <span className="filter-count-badge">{activeCount}</span>
                )}
            </button>

            <div className={`filter-layout-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="backup-filters-content">
                    <select
                        name="type"
                        className="backup-filter-select"
                        value={filters.type || ''}
                        onChange={handleFilterChange}
                    >
                        <option value="">All Types</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Unscheduled">Unscheduled</option>
                    </select>
                    <select
                        name="status"
                        className="backup-filter-select"
                        value={filters.status || ''}
                        onChange={handleFilterChange}
                    >
                        <option value="">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Restored">Restored</option>
                    </select>
                    <button
                        type="button"
                        className={`backup-filter-pill ${filters.includeArchived ? 'active' : ''}`}
                        onClick={toggleArchived}
                    >
                        Include archived
                    </button>
                    {activeCount > 0 && (
                        <button type="button" className="backup-filter-clear" onClick={clearFilters}>
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupInterruptionFiltersBar;
