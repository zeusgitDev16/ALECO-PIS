import React from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';

export function getActiveMemoFiltersCount(filters) {
    return [
        filters.status,
        filters.category,
        filters.district,
        filters.municipality,
        filters.receivedBy,
    ].filter(Boolean).length;
}

const MEMO_STATUS_OPTIONS = [
    { value: 'saved', label: 'Saved' },
    { value: 'closed', label: 'Closed' },
];

const BackupMemoFiltersForm = ({ filters, setFilters, showClear = true }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (val) => {
        setFilters((prev) => ({ ...prev, category: val }));
    };

    const handleLocationChange = (locObj) => {
        if (locObj && (locObj.district || locObj.municipality)) {
            setFilters((prev) => ({
                ...prev,
                district: locObj.district || '',
                municipality: locObj.municipality || '',
            }));
        } else {
            setFilters((prev) => ({ ...prev, district: '', municipality: '' }));
        }
    };

    const clearFilters = () => {
        setFilters({ status: '', category: '', district: '', municipality: '', receivedBy: '' });
    };

    const activeCount = getActiveMemoFiltersCount(filters);

    return (
        <>
            <select
                name="status"
                className="backup-filter-select"
                value={filters.status || ''}
                onChange={handleChange}
            >
                <option value="">All Status</option>
                {MEMO_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>

            <IssueCategoryDropdown
                value={filters.category || ''}
                onChange={handleCategoryChange}
                isFilter={true}
                layoutMode="inline"
            />

            <AlecoScopeDropdown
                onLocationSelect={handleLocationChange}
                isFilter={true}
                layoutMode="inline"
                initialDistrict={filters.district || ''}
                initialMunicipality={filters.municipality || ''}
            />

            <input
                type="text"
                name="receivedBy"
                className="backup-filter-select"
                value={filters.receivedBy || ''}
                onChange={handleChange}
                placeholder="Received by…"
                style={{ minWidth: 130 }}
            />

            {showClear && activeCount > 0 && (
                <button type="button" className="backup-filter-clear" onClick={clearFilters}>
                    Clear
                </button>
            )}
        </>
    );
};

export default BackupMemoFiltersForm;
