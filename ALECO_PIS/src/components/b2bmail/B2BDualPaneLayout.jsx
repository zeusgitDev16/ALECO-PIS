import React from 'react';
import '../../CSS/B2BFilterLayout.css';

const B2BDualPaneLayout = ({
  topBar,
  leftPane,
  rightPane,
  leftPaneCollapsed = false,
}) => {
  return (
    <div className="b2b-dual-pane">
      <div className="b2b-top-bar">{topBar}</div>
      <div className="b2b-panes-row">
        <aside className={`b2b-left-pane ${leftPaneCollapsed ? 'collapsed' : ''}`}>
          {leftPane}
        </aside>
        <section className="b2b-right-pane">{rightPane}</section>
      </div>
    </div>
  );
};

export default B2BDualPaneLayout;
