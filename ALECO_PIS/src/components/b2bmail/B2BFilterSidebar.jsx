import React from 'react';
import '../../CSS/B2BFilterLayout.css';

const B2BFilterSidebar = ({
  activeCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  onClearAll,
  children,
}) => {
  if (isCollapsed) {
    return (
      <div className="b2b-filter-sidebar b2b-filter-sidebar-collapsed">
        <button
          type="button"
          className="b2b-filter-sidebar-expand"
          onClick={onToggleCollapse}
          aria-label="Expand filters"
          title="Show filters"
        >
          ☰
          {activeCount > 0 && <span className="b2b-filter-active-badge">{activeCount}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="b2b-filter-sidebar" aria-label="B2B filters">
      <div className="b2b-filter-sidebar-actions">
        <button
          type="button"
          className="b2b-filter-sidebar-action"
          onClick={onToggleCollapse}
          aria-label="Collapse filters"
          title="Collapse filters"
        >
          ◀
        </button>
        {activeCount > 0 && (
          <span className="b2b-filter-active-count" title={`${activeCount} filter(s) active`}>
            {activeCount}
          </span>
        )}
        <button
          type="button"
          className="b2b-filter-sidebar-action"
          onClick={onClearAll}
          aria-label="Reset filters"
          title="Reset filters"
        >
          ↺
        </button>
      </div>
      <div className="b2b-filter-sidebar-content">{children}</div>
    </div>
  );
};

export default B2BFilterSidebar;
