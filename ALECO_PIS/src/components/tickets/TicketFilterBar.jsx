import React from 'react';
import '../../CSS/TicketDashboard.css'; // Adjust path as needed

const TicketFilterBar = ({ activeTab, setActiveTab, filters, setFilters }) => {
    
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="ticket-filter-bar">
            {/* TABS */}
            <div className="ticket-tabs">
                <button 
                    className={`ticket-tab-btn ${activeTab === 'Open' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveTab('Open')}
                >
                    Open Issues
                </button>
                <button 
                    className={`ticket-tab-btn ${activeTab === 'Closed' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveTab('Closed')}
                >
                    Restored
                </button>
            </div>

            {/* FILTERS */}
            <div className="ticket-filters">
                <input 
                    type="text" 
                    name="searchQuery"
                    placeholder="Search ID, Name, or Concern..." 
                    className="filter-input"
                    value={filters.searchQuery}
                    onChange={handleFilterChange}
                />
                
                <select 
                    name="municipality" 
                    className="filter-select"
                    value={filters.municipality}
                    onChange={handleFilterChange}
                >
                    <option value="">All Municipalities</option>
                    <option value="Legazpi City">Legazpi City</option>
                    <option value="Daraga">Daraga</option>
                    <option value="Tabaco City">Tabaco City</option>
                    {/* Add remaining ALECO scope municipalities */}
                </select>

                <select 
                    name="category" 
                    className="filter-select"
                    value={filters.category}
                    onChange={handleFilterChange}
                >
                    <option value="">All Categories</option>
                    <option value="Power Outage">Power Outage</option>
                    <option value="Fallen Post">Fallen Post</option>
                    <option value="Broken Wire">Broken Wire</option>
                    <option value="Billing Issue">Billing Issue</option>
                </select>
            </div>
        </div>
    );
};

export default TicketFilterBar;