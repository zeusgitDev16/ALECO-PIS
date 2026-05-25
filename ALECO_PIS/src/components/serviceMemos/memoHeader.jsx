import React, { useState } from 'react';
import '../../CSS/ServiceMemos.css';
import ServiceMemoTabs from './ServiceMemoTabs';

const MemoHeader = ({ filters, setFilters, activeTab, setActiveTab, onRefresh, loading }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`memo-header-container${collapsed ? ' memo-header-container--collapsed' : ''}`}>
      <div className="memo-header-toggle-bar">
        <span className="memo-header-toggle-label">Filters &amp; Search</span>
        <div className="memo-header-toggle-actions">
          {onRefresh && (
            <button
              type="button"
              className="memo-header-icon-btn"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh list"
              title="Refresh list"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          )}
          <button
            type="button"
            className="memo-header-toggle-btn"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {collapsed ? '▼ Show' : '▲ Hide'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="memo-header-content">
          <ServiceMemoTabs filters={filters} setFilters={setFilters} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      )}
    </div>
  );
};

export default MemoHeader;
