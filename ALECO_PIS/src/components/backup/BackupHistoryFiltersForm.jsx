import React from 'react';

const MODULE_OPTIONS = [
    { value: 'tickets', label: 'Tickets' },
    { value: 'interruptions', label: 'Interruptions' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'users', label: 'Users' },
    { value: 'data_management', label: 'Data Mgmt' },
    { value: 'b2b', label: 'B2B Mail' },
];

const ALL_MODULES = MODULE_OPTIONS.map((item) => item.value);

function normalizeModules(modules) {
    if (!Array.isArray(modules) || modules.length === 0) return ALL_MODULES;
    const picked = modules.filter((item) => ALL_MODULES.includes(item));
    return picked.length > 0 ? picked : ALL_MODULES;
}

export function getActiveHistoryFiltersCount(filters = {}) {
    const modules = normalizeModules(filters.modules);
    let count = 0;
    if (modules.length !== ALL_MODULES.length) count += 1;
    if (String(filters.q || '').trim()) count += 1;
    if (String(filters.actor || '').trim()) count += 1;
    return count;
}

const BackupHistoryFiltersForm = ({ filters, setFilters }) => {
    const modules = normalizeModules(filters?.modules);

    const toggleModule = (moduleValue) => {
        setFilters((prev) => {
            const current = normalizeModules(prev?.modules);
            const exists = current.includes(moduleValue);
            const next = exists
                ? current.filter((item) => item !== moduleValue)
                : [...current, moduleValue];
            return { ...prev, modules: next.length > 0 ? next : ALL_MODULES };
        });
    };

    const clearFilters = () => {
        setFilters({
            modules: ALL_MODULES,
            q: '',
            actor: '',
        });
    };

    return (
        <>
            <div className="aleco-scope-inline">
                {MODULE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`backup-filter-pill ${modules.includes(option.value) ? 'active' : ''}`}
                        onClick={() => toggleModule(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <input
                type="text"
                className="backup-filter-select backup-filter-input"
                placeholder="Search details/entity"
                value={filters?.q || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <input
                type="text"
                className="backup-filter-select backup-filter-input"
                placeholder="Actor email/name"
                value={filters?.actor || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, actor: e.target.value }))}
            />
            <button type="button" className="backup-filter-clear" onClick={clearFilters}>
                Clear
            </button>
        </>
    );
};

export default BackupHistoryFiltersForm;
