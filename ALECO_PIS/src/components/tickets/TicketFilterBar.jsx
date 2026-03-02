import React from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown'; 
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';      
import '../../CSS/TicketDashboard.css';

const TicketFilterBar = ({ activeTab, setActiveTab, filters, setFilters }) => {
    
    // 1. Generic handler for standard inputs (like the main Search bar)
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    /**
     * 2. Optimized Location Handler
     * Receives the full object from AlecoScopeDropdown.
     * Even if a field is "All", it arrives as an empty string or null,
     * allowing for instant database filtering.
     */
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
            // Safety fallback to clear all location-related filters
            setFilters(prev => ({
                ...prev,
                district: "",
                municipality: "",
                barangay: "",
                purok: ""
            }));
        }
    };

    // 3. Simple handler for the Category selection
    const handleCategoryChange = (val) => {
        setFilters(prev => ({ ...prev, category: val }));
    };

    return (
        <div className="ticket-filter-bar">
            {/* TAB SELECTION: Open vs Closed Tickets */}
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

            {/* DASHBOARD ANALYTICS CONTROLS */}
            <div className="ticket-filters">
                
                {/* ID/Name Search Input */}
                <input 
                    type="text" 
                    name="searchQuery"
                    placeholder="Search ID, Name, or Concern..." 
                    className="filter-input"
                    value={filters.searchQuery}
                    onChange={handleFilterChange}
                />
                
                {/* Issue Category: Now with "All Categories" option and 38px inline height */}
                <IssueCategoryDropdown 
                    value={filters.category} 
                    onChange={handleCategoryChange}
                    isFilter={true} 
                    layoutMode="inline" 
                />

                {/* Aleco Scope: Now transformed for the Dashboard.
                  - All 4 levels (District, Muni, Brgy, Purok) are visible.
                  - Brgy is a fixed dropdown instead of search.
                  - Selecting "All Districts" resets children automatically.
                */}
                <AlecoScopeDropdown 
                    onLocationSelect={handleLocationChange}
                    isFilter={true} 
                    layoutMode="inline" 
                />

            </div>
        </div>
    );
};

export default TicketFilterBar;