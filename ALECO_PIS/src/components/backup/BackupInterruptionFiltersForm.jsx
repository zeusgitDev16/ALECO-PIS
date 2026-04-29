import React from 'react';

export function getActiveInterruptionFiltersCount(filters) {
    return [filters.type, filters.status, filters.includeArchived].filter(Boolean).length;
}

const BackupInterruptionFiltersForm = ({ filters, setFilters, showClear = true }) => {
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

    const activeCount = getActiveInterruptionFiltersCount(filters);

    return (
        <>
            <select
                name="type"
                className="backup-filter-select"
                value={filters.type || ''}
                onChange={handleFilterChange}
            >
                <option value="">All Types</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Emergency">Emergency</option>
                <option value="NgcScheduled">NGCP scheduled</option>
                <option value="CustomPoster">Power interruption (custom)</option>
            </select>
            <select
                name="status"
                className="backup-filter-select"
                value={filters.status || ''}
                onChange={handleFilterChange}
            >
                <option value="">All Status</option>
                <option value="Pending">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Energized">Energized</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Rescheduled">Rescheduled</option>
            </select>
            <button
                type="button"
                className={`backup-filter-pill ${filters.includeArchived ? 'active' : ''}`}
                onClick={toggleArchived}
            >
                Include archived
            </button>
            {showClear && activeCount > 0 && (
                <button type="button" className="backup-filter-clear" onClick={clearFilters}>
                    Clear
                </button>
            )}
        </>
    );
};

export default BackupInterruptionFiltersForm;
