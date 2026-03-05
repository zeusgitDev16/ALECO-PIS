import React from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown'; 
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';      
import '../../CSS/TicketDashboard.css';


const TicketFilterBar = ({ activeTab, setActiveTab, filters, setFilters, tickets, selectedIds, setSelectedIds }) => {
    
    // 1. Generic handler for standard inputs (Search, Date Preset, Custom Dates)
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // 2. Toggle Handler for the "New (<48h)" filter
    const toggleUrgentNew = () => {
        setFilters(prev => ({ ...prev, isNew: !prev.isNew }));
    };

    // 3. Location Handler (Unchanged, optimized logic)
    const handleLocationChange = (locObj) => {
        if (locObj) {
            setFilters(prev => ({
                ...prev,
                district: locObj.district || "",
                municipality: locObj.municipality || "",
                barangay: locObj.barangay || "",
                purok: locObj.purok || ""
            }));
        } else {
            setFilters(prev => ({
                ...prev, district: "", municipality: "", barangay: "", purok: ""
            }));
        }
    };

    // 4. Category Handler (Unchanged)
    const handleCategoryChange = (val) => {
        setFilters(prev => ({ ...prev, category: val }));
    };

    // Placeholder for Export Actions
    const handleExport = (type) => {
        console.log(`Triggering ${type} report generation...`);
        // Logic to trigger PDF/CSV download will go here
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
                <div className="ticket-tabs">
                    <button 
                        className={`ticket-tab-btn ${activeTab === 'Open' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('Open')}
                    >
                        Open 
                    </button>
                    <button 
                        className={`ticket-tab-btn ${activeTab === 'Closed' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('Closed')}
                    >
                        Closed
                    </button>
                </div>

                {/* ⚡ The New 48-Hour Toggle */}
                <button 
                    className={`urgent-toggle-btn ${filters.isNew ? 'active' : ''}`}
                    onClick={toggleUrgentNew}
                    title="Show tickets submitted in the last 48 hours"
                >
                    <span className="urgent-icon">⚡</span> New (48h)
                </button>

                {/* Grouped Search and Category to stay side-by-side */}
                <div className="search-category-group">
                    <input 
                        type="text" 
                        name="searchQuery"
                        placeholder="Search ID, Name..." 
                        className="filter-input main-search"
                        value={filters.searchQuery || ""}
                        onChange={handleFilterChange}
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
                TIER 3: Analytics & Reporting Actions
                ========================================= */}
            <div className="filter-tier filter-tier-3">
                
                {/* Smart Date Filtering */}
                <div className="date-filter-group">
                    <span className="group-label">📅 Date:</span>
                    <select 
                        name="datePreset" 
                        className="filter-select date-preset"
                        value={filters.datePreset || ""}
                        onChange={handleFilterChange}
                    >
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="last7">Last 7 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="custom">Custom Range...</option>
                    </select>

                    {/* Appears ONLY if "Custom Range" is selected */}
                    {filters.datePreset === 'custom' && (
                        <div className="custom-date-inputs">
                            <input 
                                type="date" 
                                name="startDate" 
                                className="filter-input date-picker"
                                value={filters.startDate || ""} 
                                onChange={handleFilterChange} 
                            />
                            <span>to</span>
                            <input 
                                type="date" 
                                name="endDate" 
                                className="filter-input date-picker"
                                value={filters.endDate || ""} 
                                onChange={handleFilterChange} 
                            />
                        </div>
                    )}
                </div>

                {/* Export / Report Actions */}
                <div className="report-actions-group">
                    <button className="action-btn weekly-btn" onClick={() => handleExport('weekly')}>
                        📥 Weekly Report
                    </button>
                    <button className="action-btn monthly-btn" onClick={() => handleExport('monthly')}>
                        📥 Monthly Report
                    </button>
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
            
        </div>
    );
};

export default TicketFilterBar;