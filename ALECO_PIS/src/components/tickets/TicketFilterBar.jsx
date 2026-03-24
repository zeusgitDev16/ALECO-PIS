import React, { useState, useRef, useEffect } from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown'; 
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';      
import '../../CSS/TicketDashboard.css';

const DEBOUNCE_MS = 400;

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

const TicketFilterBar = ({ filters, setFilters, tickets, selectedIds, setSelectedIds }) => {
    const [searchInput, setSearchInput] = useState(filters.searchQuery || '');
    const debounceRef = useRef(null);

    useEffect(() => {
        setSearchInput(filters.searchQuery || '');
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
    }, [filters.searchQuery]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, searchQuery: value }));
            debounceRef.current = null;
        }, DEBOUNCE_MS);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

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

    const handleClearAll = () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        setSearchInput('');
        setFilters(prev => ({ ...prev, ...getDefaultFilterOverrides() }));
    };

    // 1. Generic handler for standard inputs (Search, Date Preset, Custom Dates)
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // 2. Toggle Handler for the "New (<48h)" filter
    const toggleUrgentNew = () => {
        setFilters(prev => ({ ...prev, isNew: !prev.isNew }));
    };

    // 3. Location Handler (CLEANED: Only district & municipality)
    const handleLocationChange = (locObj) => {
        if (locObj && (locObj.district || locObj.municipality)) {
            console.log('📍 Location Filter Changed:', locObj);
            setFilters(prev => ({
                ...prev,
                district: locObj.district || "",
                municipality: locObj.municipality || ""
            }));
        } else {
            // Clear location filters
            console.log('📍 Location Filter Cleared');
            setFilters(prev => ({
                ...prev, 
                district: "", 
                municipality: ""
            }));
        }
    };

    // 4. Category Handler
    const handleCategoryChange = (val) => {
        console.log('🏷️ Category Filter Changed:', val);
        setFilters(prev => ({ ...prev, category: val }));
    };

    // 5. Status Handler
    const handleStatusChange = (e) => {
        const { value } = e.target;
        console.log('📊 Status Filter Changed:', value);
        setFilters(prev => ({ ...prev, status: value }));
    };

    const isAllVisibleSelected = tickets?.length > 0 && selectedIds?.length === tickets?.length;

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            setSelectedIds([]); 
        } else {
            setSelectedIds(tickets.map(ticket => ticket.ticket_id)); 
        }
    };

    return (
        <div className="ticket-filter-bar">
            
            {/* =========================================
                TIER 1: Primary Hooks + Category
                ========================================= */}
            <div className="filter-tier filter-tier-1">
                {/* ⚡ The New 48-Hour Toggle */}
                <button
                    className={`urgent-toggle-btn ${filters.isNew ? 'active' : ''}`}
                    onClick={toggleUrgentNew}
                    title="Show tickets submitted in the last 48 hours"
                >
                    <span className="urgent-icon">⚡</span> New (48h)
                </button>

                {/* 📊 Status Filter Dropdown */}
                <select
                    name="status"
                    className="status-filter-select"
                    value={filters.status || ""}
                    onChange={handleStatusChange}
                    title="Filter by ticket status"
                >
                    <option value="">📊 All Status</option>
                    <option value="Pending">⏳ Pending</option>
                    <option value="Ongoing">🔧 Ongoing</option>
                    <option value="Restored">✅ Restored</option>
                    <option value="Unresolved">❌ Unresolved</option>
                    <option value="NoFaultFound">○ No Fault Found</option>
                    <option value="AccessDenied">🚫 Access Denied</option>
                </select>

                {/* 🔗 Group Filter: All | Groups only | Filter out groups */}
                <select
                    name="groupFilter"
                    className="status-filter-select group-filter-select"
                    value={filters.groupFilter || "all"}
                    onChange={handleFilterChange}
                    title="Filter by group: show all, only groups, or hide groups"
                >
                    <option value="all">🔗 All</option>
                    <option value="grouped">📦 Groups Only</option>
                    <option value="ungrouped">📋 Filter Out Groups</option>
                </select>

                {/* Search: matches child ticket → shows parent group (debounced) */}
                <div className="search-category-group">
                    <input 
                        type="text" 
                        name="searchQuery"
                        placeholder="Search ID, name... (child ticket shows its group)" 
                        className="filter-input main-search"
                        value={searchInput}
                        onChange={handleSearchChange}
                    />
                    <IssueCategoryDropdown 
                        value={filters.category || ""} 
                        onChange={handleCategoryChange}
                        isFilter={true} 
                        layoutMode="inline" 
                    />
                </div>
            </div>

            {/* =========================================
                TIER 2: Context / Location Filters ONLY
                ========================================= */}
            <div className="filter-tier filter-tier-2">
                <AlecoScopeDropdown 
                    onLocationSelect={handleLocationChange}
                    isFilter={true} 
                    layoutMode="inline" 
                />
            </div>

            {/* =========================================
                TIER 3: Date Filter
                ========================================= */}
            <div className="filter-tier filter-tier-3">
                
                {/* Smart Date Filtering */}
                <div className="date-filter-group">
                    <select
                        name="datePreset"
                        className="date-preset-select"
                        value={filters.datePreset || ""}
                        onChange={handleFilterChange}
                    >
                        <option value="">📅 All Time</option>
                        <option value="today">Today</option>
                        <option value="last7">Last 7 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="custom">Custom Range...</option>
                    </select>

                    {/* Appears ONLY if "Custom Range" is selected */}
                    {filters.datePreset === 'custom' && (
                        <>
                            <input
                                type="date"
                                name="startDate"
                                className="date-input"
                                value={filters.startDate || ""}
                                onChange={handleFilterChange}
                            />
                            <span className="date-range-separator">to</span>
                            <input
                                type="date"
                                name="endDate"
                                className="date-input"
                                value={filters.endDate || ""}
                                onChange={handleFilterChange}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* --- NEW JSX: TIER 4 (Select All Bar) --- */}
            {tickets?.length > 0 && (
                <div className={`filter-tier filter-tier-select-all ${selectedIds?.length > 0 ? 'has-selection' : ''}`}>
                    <label className="select-all-label">
                        <input 
                            type="checkbox" 
                            className="select-all-checkbox"
                            checked={isAllVisibleSelected}
                            onChange={toggleSelectAll}
                        />
                        <span className="select-all-text">
                            Select All
                            <span className="visible-count">({tickets.length})</span>
                        </span>
                    </label>
                    
                    {selectedIds?.length > 0 && (
                        <button 
                            className="btn-clear-selection" 
                            onClick={() => setSelectedIds([])}
                        >
                            Clear Selection ({selectedIds.length})
                        </button>
                    )}
                </div>
            )}

            {/* Clear All / Reset filters - same as sidebar */}
            <div className="filter-drawer-actions">
                {getActiveFiltersCount() > 0 && (
                    <button
                        type="button"
                        className="filter-drawer-clear-btn"
                        onClick={handleClearAll}
                        title="Clear all filters"
                        aria-label="Clear all filters"
                    >
                        ✕ Clear All
                    </button>
                )}
                <button
                    type="button"
                    className="filter-drawer-reset-btn"
                    onClick={handleClearAll}
                    title="Reset filters"
                    aria-label="Reset all filters"
                >
                    ↻ Reset
                </button>
            </div>
            
        </div>
    );
};

export default TicketFilterBar;
