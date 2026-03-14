import React, { useState, useEffect } from 'react';
import '../../CSS/TicketFilterLayoutWrapper.css';

const TicketFilterLayoutWrapper = ({ children, activeFiltersCount = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(() => {
        // Desktop: expanded by default, Mobile: collapsed by default
        const saved = localStorage.getItem('ticketFiltersExpanded');
        if (saved !== null) return saved === 'true';
        return window.innerWidth > 800; // Auto-collapse on mobile/tablet
    });

    useEffect(() => {
        localStorage.setItem('ticketFiltersExpanded', isExpanded);
    }, [isExpanded]);

    const toggleFilters = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="filter-layout-wrapper">
            {/* Toggle Button */}
            <button 
                className="filter-toggle-btn" 
                onClick={toggleFilters}
                aria-label={isExpanded ? "Hide filters" : "Show filters"}
            >
                <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
                <span className="toggle-text">
                    {isExpanded ? 'Hide Filters' : 'Show Filters'}
                </span>
                {!isExpanded && activeFiltersCount > 0 && (
                    <span className="filter-count-badge">{activeFiltersCount}</span>
                )}
            </button>

            {/* Collapsible Content */}
            <div className={`filter-layout-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                {children}
            </div>
        </div>
    );
};

export default TicketFilterLayoutWrapper;

