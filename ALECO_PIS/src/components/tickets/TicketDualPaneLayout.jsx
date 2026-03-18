import React from 'react';
import '../../CSS/TicketDualPaneLayout.css';

/**
 * TicketDualPaneLayout - Dual-pane shell for Tickets page
 * Left pane: filters (narrow)
 * Right pane: ticket content (main area)
 * Top bar: layout picker
 */
const TicketDualPaneLayout = ({ leftPane, rightPane, layoutPicker, selectAllBar, leftPaneCollapsed = false }) => {
    return (
        <div className="tickets-dual-pane">
            <div className="tickets-top-bar">
                {layoutPicker}
                {selectAllBar}
            </div>
            <div className="tickets-panes-row">
                <div className={`tickets-left-pane ${leftPaneCollapsed ? 'collapsed' : ''}`}>
                    {leftPane}
                </div>
                <div className="tickets-right-pane">
                    {rightPane}
                </div>
            </div>
        </div>
    );
};

export default TicketDualPaneLayout;
