import React, { useState } from 'react';
import '../../CSS/ServiceMemos.css';
import ServiceMemoTabs from './ServiceMemoTabs';

const MemoHeader = ({ filters, setFilters, activeTab, setActiveTab }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`memo-header-container${collapsed ? ' memo-header-container--collapsed' : ''}`}>
      <div className="memo-header-toggle-bar">
        <span className="memo-header-toggle-label">Filters &amp; Search</span>
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
      {!collapsed && (
        <div className="memo-header-content">
          <ServiceMemoTabs filters={filters} setFilters={setFilters} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      )}
    </div>
  );
};

export default MemoHeader;
