import React, { useState, useEffect } from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';
import '../../CSS/TicketFilterLayoutWrapper.css';
import '../../CSS/Backup.css';

const BackupFiltersBar = ({ filters, setFilters }) => {
    const [isExpanded, setIsExpanded] = useState(() => {
        const saved = localStorage.getItem('backupFiltersExpanded');
        if (saved !== null) return saved === 'true';
        return false;
    });

    useEffect(() => {
        localStorage.setItem('backupFiltersExpanded', isExpanded);
    }, [isExpanded]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (val) => {
        setFilters(prev => ({ ...prev, category: val }));
    };

    const handleLocationChange = (locObj) => {
        if (locObj && (locObj.district || locObj.municipality)) {
            setFilters(prev => ({
                ...prev,
                district: locObj.district || '',
                municipality: locObj.municipality || ''
            }));
        } else {
            setFilters(prev => ({ ...prev, district: '', municipality: '' }));
        }
    };

    const toggleNew = () => setFilters(prev => ({ ...prev, isNew: !prev.isNew }));
    const toggleUrgent = () => setFilters(prev => ({ ...prev, isUrgent: !prev.isUrgent }));

    const clearFilters = () => {
        setFilters({
            category: '',
            district: '',
            municipality: '',
            status: '',
            groupFilter: 'all',
            isNew: false,
            isUrgent: false
        });
    };

    const activeCount = [
        filters.category,
        filters.district,
        filters.municipality,
        filters.status,
        filters.groupFilter && filters.groupFilter !== 'all',
        filters.isNew,
        filters.isUrgent
    ].filter(Boolean).length;

    return (
        <div className="filter-layout-wrapper backup-filters-wrapper">
            <button
                className="filter-toggle-btn"
                onClick={() => setIsExpanded(!isExpanded)}
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
                    <button
                        className={`backup-filter-pill ${filters.isNew ? 'active' : ''}`}
                        onClick={toggleNew}
                        type="button"
                    >
                        New (48h)
                    </button>
                    <button
                        className={`backup-filter-pill ${filters.isUrgent ? 'active' : ''}`}
                        onClick={toggleUrgent}
                        type="button"
                    >
                        Urgent
                    </button>
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
                        <option value="Unresolved">Unresolved</option>
                        <option value="NoFaultFound">No Fault Found</option>
                        <option value="AccessDenied">Access Denied</option>
                    </select>
                    <select
                        name="groupFilter"
                        className="backup-filter-select"
                        value={filters.groupFilter || 'all'}
                        onChange={handleFilterChange}
                    >
                        <option value="all">All</option>
                        <option value="grouped">Groups Only</option>
                        <option value="ungrouped">Filter Out Groups</option>
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

export default BackupFiltersBar;
