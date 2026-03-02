import React from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown'; // Adjust paths
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';      // Adjust paths
import '../../CSS/TicketDashboard.css';

const TicketFilterBar = ({ activeTab, setActiveTab, filters, setFilters }) => {
    
    // 1. Generic handler for standard inputs (like Search)
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // 2. Specialized handler for the complex location object
    const handleLocationChange = (locObj) => {
        // Only update if we have a valid object (null is sent when cleared)
        if (locObj) {
            setFilters(prev => ({
                ...prev,
                district: locObj.district || "",
                municipality: locObj.municipality || "",
                barangay: locObj.barangay || "",
                purok: locObj.purok || ""
            }));
        } else {
            // Reset location filters if cleared
            setFilters(prev => ({
                ...prev,
                district: "",
                municipality: "",
                barangay: "",
                purok: ""
            }));
        }
    };

    // 3. Simple handler for the Category string
    const handleCategoryChange = (val) => {
        setFilters(prev => ({ ...prev, category: val }));
    };

    return (
        <div className="ticket-filter-bar">
            {/* TABS (Open/Closed) */}
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

            {/* ADVANCED ANALYTICS FILTERS */}
            <div className="ticket-filters">
                
                {/* Text Search */}
                <input 
                    type="text" 
                    name="searchQuery"
                    placeholder="Search ID, Name, or Concern..." 
                    className="filter-input"
                    value={filters.searchQuery}
                    onChange={handleFilterChange}
                />
                
                {/* Reusable Category Filter */}
                <IssueCategoryDropdown 
                    value={filters.category} 
                    onChange={handleCategoryChange}
                    isFilter={true} // Enables "All Categories" mode
                />

                {/* Reusable Location Filter (District/Muni/Brgy/Purok) */}
                <AlecoScopeDropdown 
                    onLocationSelect={handleLocationChange}
                    isFilter={true} // Enables partial/all selection mode
                />

            </div>
        </div>
    );
};

export default TicketFilterBar;