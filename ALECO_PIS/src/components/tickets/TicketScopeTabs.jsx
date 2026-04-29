import React from 'react';
import '../../CSS/TicketScopeTabs.css';

/**
 * TicketScopeTabs - Switches between Urgent, Regular, and Memo-linked sections.
 * Recent Opened Tickets is always visible above the dual pane (separate strip).
 */
const TicketScopeTabs = ({ scope, onScopeChange, urgentCount, regularCount, memoLinkedCount }) => {
  const tabs = [
    { id: 'urgent', label: 'Urgent', count: urgentCount, icon: '🚨' },
    { id: 'regular', label: 'Regular', count: regularCount, icon: '📋' },
    { id: 'memo', label: 'Memo Linked', count: memoLinkedCount, icon: '🧾' },
  ];

  return (
    <div className="ticket-scope-tabs" role="tablist" aria-label="Ticket section">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={scope === tab.id}
          aria-controls={`ticket-panel-${tab.id}`}
          id={`ticket-tab-${tab.id}`}
          className={`ticket-scope-tab ${scope === tab.id ? 'active' : ''} ${tab.id === 'urgent' && tab.count > 0 ? 'has-urgent' : ''}`}
          onClick={() => onScopeChange(tab.id)}
        >
          <span className="ticket-scope-tab-icon">{tab.icon}</span>
          <span className="ticket-scope-tab-label">{tab.label}</span>
          <span className="ticket-scope-tab-count">({tab.count})</span>
        </button>
      ))}
    </div>
  );
};

export default TicketScopeTabs;
