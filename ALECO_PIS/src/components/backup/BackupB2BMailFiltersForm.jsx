import React from 'react';

export function getActiveB2BMailFiltersCount(filters) {
    if (!filters) return 0;
    return [
        filters.status,
        filters.q,
    ].filter(Boolean).length;
}

const B2B_MAIL_STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'queued', label: 'Queued/Sending' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
];

const BackupB2BMailFiltersForm = ({ filters, setFilters, showClear = true }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ status: '', q: '' });
    };

    const activeCount = getActiveB2BMailFiltersCount(filters);

    return (
        <>
            <select
                name="status"
                className="backup-filter-select"
                value={filters.status || ''}
                onChange={handleChange}
            >
                <option value="">All Status</option>
                {B2B_MAIL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>

            <input
                type="text"
                name="q"
                className="backup-filter-select"
                value={filters.q || ''}
                onChange={handleChange}
                placeholder="Search subject/body…"
                style={{ minWidth: 160 }}
            />

            {showClear && activeCount > 0 && (
                <button type="button" className="backup-filter-clear" onClick={clearFilters}>
                    Clear
                </button>
            )}
        </>
    );
};

export default BackupB2BMailFiltersForm;
