import React from 'react';

const ServiceMemoTabs = ({ activeTab, onTabChange }) => {
  return (
    <div className="service-memos-tabs">
      <button
        className={`service-memo-tab ${activeTab === 'draft' ? 'service-memo-tab--active' : ''}`}
        onClick={() => onTabChange('draft')}
        title="Your draft service memos"
      >
        Draft
      </button>
      <button
        className={`service-memo-tab ${activeTab === 'saved' ? 'service-memo-tab--active' : ''}`}
        onClick={() => onTabChange('saved')}
        title="Your saved service memos ready for printing"
      >
        Saved
      </button>
      <button
        className={`service-memo-tab ${activeTab === 'closed' ? 'service-memo-tab--active' : ''}`}
        onClick={() => onTabChange('closed')}
        title="Your closed service memos"
      >
        Closed
      </button>
      <button
        className={`service-memo-tab ${activeTab === 'all' ? 'service-memo-tab--active' : ''}`}
        onClick={() => onTabChange('all')}
        title="All service memos in the system"
      >
        All
      </button>
    </div>
  );
};

export default ServiceMemoTabs;
