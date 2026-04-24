import React from 'react';
import '../../CSS/ServiceMemos.css';
import ServiceMemoTabs from './ServiceMemoTabs';

const MemoHeader = ({ filters, setFilters, activeTab, setActiveTab }) => {
  return (
    <div className="memo-header-container">
      <div className="memo-header-content">
        <ServiceMemoTabs filters={filters} setFilters={setFilters} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export default MemoHeader;
