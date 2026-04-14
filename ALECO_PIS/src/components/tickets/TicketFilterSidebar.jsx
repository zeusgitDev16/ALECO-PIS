import React, { useState, useRef, useEffect } from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';
import FilterModal from './FilterModal';
import '../../CSS/TicketFilterSidebar.css';

const getDefaultFilterOverrides = () => ({
    isNew: false,
    isUrgent: false,
    status: '',
    searchQuery: '',
    category: '',
    district: '',
    municipality: '',
    datePreset: '',
    startDate: '',
    endDate: '',
    groupFilter: 'all'
});

const FILTER_ICONS = {
    new: '⚡',
    status: '📊',
    group: '🔗',
    category: '🏷️',
    location: '📍',
    date: '📅',
    search: '🔍'
};

const FILTER_LABELS = {
    new: 'New (48h)',
    status: 'Status',
    group: 'Group',
    category: 'Category',
    location: 'Location',
    date: 'Date range',
    search: 'Search'
};

const DEBOUNCE_MS = 400;

const TicketFilterSidebar = ({ filters, setFilters, tickets, selectedIds, setSelectedIds, isCollapsed = false, onToggleCollapse }) => {
    const [activeModal, setActiveModal] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const debounceRef = useRef(null);
    const prevModalRef = useRef(null);

    useEffect(() => {
        const justOpened = activeModal === 'search' && prevModalRef.current !== 'search';
        if (justOpened) {
            setSearchInput(filters.searchQuery || '');
        }
        prevModalRef.current = activeModal;
    }, [activeModal, filters.searchQuery]);

    const applySearchFilter = (value) => {
        setFilters(prev => ({ ...prev, searchQuery: value }));
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            applySearchFilter(value);
            debounceRef.current = null;
        }, DEBOUNCE_MS);
    };

    const flushSearchDebounce = () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            applySearchFilter(searchInput);
            debounceRef.current = null;
        }
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (filters.searchQuery) count++;
        if (filters.category) count++;
        if (filters.district) count++;
        if (filters.municipality) count++;
        if (filters.datePreset) count++;
        if (filters.isNew) count++;
        if (filters.status) count++;
        if (filters.groupFilter && filters.groupFilter !== 'all') count++;
        return count;
    };

    const activeCount = getActiveFiltersCount();

    const handleClearAll = () => {
        setFilters(prev => ({ ...prev, ...getDefaultFilterOverrides() }));
        setActiveModal(null);
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const toggleUrgentNew = () => setFilters(prev => ({ ...prev, isNew: !prev.isNew }));

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

    const handleCategoryChange = (val) => setFilters(prev => ({ ...prev, category: val }));

    const handleStatusChange = (e) => setFilters(prev => ({ ...prev, status: e.target.value }));

    const openModal = (id) => setActiveModal(id);
    const closeModal = () => {
        if (activeModal === 'search') flushSearchDebounce();
        setActiveModal(null);
    };

    const hasActiveFilter = (key) => {
        if (key === 'new') return filters.isNew;
        if (key === 'urgent') return filters.isUrgent;
        if (key === 'status') return !!filters.status;
        if (key === 'group') return filters.groupFilter && filters.groupFilter !== 'all';
        if (key === 'category') return !!filters.category;
        if (key === 'location') return !!(filters.district || filters.municipality);
        if (key === 'date') return !!(filters.datePreset || filters.startDate || filters.endDate);
        if (key === 'search') return !!filters.searchQuery;
        return false;
    };

    const FilterIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
    );

    const RefreshIcon = () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
    );

    if (isCollapsed && onToggleCollapse) {
        return (
            <div className="filter-sidebar filter-sidebar-collapsed">
                <div className="filter-sidebar-banner-wrap">
                    <button
                        type="button"
                        className="filter-sidebar-banner-btn"
                        onClick={onToggleCollapse}
                        title="Show filters"
                        aria-label="Expand filters"
                    >
                        <FilterIcon />
                        {activeCount > 0 && (
                            <span className="filter-sidebar-expand-badge">{activeCount}</span>
                        )}
                    </button>
                </div>
                <button
                    type="button"
                    className="filter-sidebar-refresh-btn filter-sidebar-refresh-btn-collapsed"
                    onClick={handleClearAll}
                    title="Reset filters"
                    aria-label="Reset all filters"
                >
                    <RefreshIcon />
                </button>
            </div>
        );
    }

    return (
        <div className="filter-sidebar">
            {activeCount > 0 && (
                <div className="filter-sidebar-badge-wrap" title={`${activeCount} filter(s) active`}>
                    <span className="filter-sidebar-badge">{activeCount}</span>
                </div>
            )}
            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${filters.isNew ? 'active' : ''}`}
                    onClick={toggleUrgentNew}
                    title="New (48h)"
                    aria-label="Filter: New in last 48 hours"
                >
                    {FILTER_ICONS.new}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.new}</span>
                </span>
            </div>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('status') ? 'active' : ''}`}
                    onClick={() => openModal('status')}
                    title="Status"
                    aria-label="Filter by status"
                    aria-expanded={activeModal === 'status'}
                >
                    {FILTER_ICONS.status}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.status}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'status'} onClose={closeModal} title="Status">
                <label className="filter-modal-label">Status</label>
                <select
                    name="status"
                    value={filters.status || ''}
                    onChange={(e) => {
                        handleStatusChange(e);
                        closeModal();
                    }}
                    className="filter-modal-select"
                >
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="OnHold">On Hold</option>
                    <option value="Restored">Restored</option>
                    <option value="Unresolved">Unresolved</option>
                    <option value="NoFaultFound">No Fault Found</option>
                    <option value="AccessDenied">Access Denied</option>
                </select>
            </FilterModal>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('group') ? 'active' : ''}`}
                    onClick={() => openModal('group')}
                    title="Group filter"
                    aria-label="Filter by group"
                    aria-expanded={activeModal === 'group'}
                >
                    {FILTER_ICONS.group}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.group}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'group'} onClose={closeModal} title="Group">
                <label className="filter-modal-label">Group</label>
                <select
                    name="groupFilter"
                    value={filters.groupFilter || 'all'}
                    onChange={(e) => {
                        handleFilterChange(e);
                        closeModal();
                    }}
                    className="filter-modal-select"
                >
                    <option value="all">All</option>
                    <option value="grouped">Groups Only</option>
                    <option value="ungrouped">Filter Out Groups</option>
                </select>
            </FilterModal>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('category') ? 'active' : ''}`}
                    onClick={() => openModal('category')}
                    title="Category"
                    aria-label="Filter by category"
                    aria-expanded={activeModal === 'category'}
                >
                    {FILTER_ICONS.category}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.category}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'category'} onClose={closeModal} title="Category">
                <label className="filter-modal-label">Category</label>
                <IssueCategoryDropdown
                    value={filters.category || ''}
                    onChange={(val) => {
                        handleCategoryChange(val);
                        closeModal();
                    }}
                    isFilter={true}
                    layoutMode="inline"
                />
            </FilterModal>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('location') ? 'active' : ''}`}
                    onClick={() => openModal('location')}
                    title="Location"
                    aria-label="Filter by district/municipality"
                    aria-expanded={activeModal === 'location'}
                >
                    {FILTER_ICONS.location}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.location}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'location'} onClose={closeModal} title="Location">
                <label className="filter-modal-label">District / Municipality</label>
                <AlecoScopeDropdown
                    onLocationSelect={handleLocationChange}
                    isFilter={true}
                    layoutMode="inline"
                    initialDistrict={filters.district || ''}
                    initialMunicipality={filters.municipality || ''}
                />
            </FilterModal>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('date') ? 'active' : ''}`}
                    onClick={() => openModal('date')}
                    title="Date range"
                    aria-label="Filter by date"
                    aria-expanded={activeModal === 'date'}
                >
                    {FILTER_ICONS.date}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.date}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'date'} onClose={closeModal} title="Date Range">
                <label className="filter-modal-label">Date</label>
                <select
                    name="datePreset"
                    value={filters.datePreset || ''}
                    onChange={handleFilterChange}
                    className="filter-modal-select"
                >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="last7">Last 7 Days</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="custom">Custom Range...</option>
                </select>
                {filters.datePreset === 'custom' && (
                    <div className="filter-modal-dates">
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate || ''}
                            onChange={handleFilterChange}
                            className="filter-modal-input"
                        />
                        <span className="filter-modal-sep">to</span>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate || ''}
                            onChange={handleFilterChange}
                            className="filter-modal-input"
                        />
                    </div>
                )}
            </FilterModal>

            <div className="filter-sidebar-btn-wrap filter-sidebar-tooltip-wrap">
                <button
                    type="button"
                    className={`filter-sidebar-btn ${hasActiveFilter('search') ? 'active' : ''}`}
                    onClick={() => openModal('search')}
                    title="Search"
                    aria-label="Search tickets"
                    aria-expanded={activeModal === 'search'}
                >
                    {FILTER_ICONS.search}
                </button>
                <span className="filter-sidebar-tooltip">
                    <span className="filter-sidebar-tooltip-text">{FILTER_LABELS.search}</span>
                </span>
            </div>
            <FilterModal isOpen={activeModal === 'search'} onClose={closeModal} title="Search">
                <label className="filter-modal-label">Search</label>
                <input
                    type="text"
                    name="searchQuery"
                    placeholder="ID, name..."
                    value={searchInput}
                    onChange={handleSearchChange}
                    className="filter-modal-input"
                    autoFocus
                />
            </FilterModal>

            <div className="filter-sidebar-actions">
                {activeCount > 0 && (
                    <button
                        type="button"
                        className="filter-sidebar-btn filter-sidebar-clear"
                        onClick={handleClearAll}
                        title="Clear all filters"
                        aria-label="Clear all filters"
                    >
                        ✕
                    </button>
                )}
                <button
                    type="button"
                    className="filter-sidebar-refresh-btn"
                    onClick={handleClearAll}
                    title="Reset filters"
                    aria-label="Reset all filters"
                >
                    <RefreshIcon />
                </button>
                {onToggleCollapse && (
                    <button
                        type="button"
                        className="filter-sidebar-btn filter-sidebar-collapse-btn"
                        onClick={onToggleCollapse}
                        title="Collapse filters"
                        aria-label="Collapse filters"
                    >
                        ◀
                    </button>
                )}
            </div>
        </div>
    );
};

export default TicketFilterSidebar;
