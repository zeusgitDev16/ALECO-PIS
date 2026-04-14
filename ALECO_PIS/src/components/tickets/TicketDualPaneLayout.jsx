import React from 'react';
import '../../CSS/TicketDualPaneLayout.css';

/**
 * TicketDualPaneLayout - Dual-pane shell for Tickets page
 * Top bar: layout picker, scope tabs (Urgent/Regular), select-all
 * Recent strip: recent opened tickets (between top bar and dual pane)
 * Dual pane: filters (left) + ticket content (right)
 */
const TicketDualPaneLayout = ({ leftPane, rightPane, layoutPicker, scopeTabs, selectAllBar, recentOpened, leftPaneCollapsed = false }) => {
    return (
        <div className="tickets-dual-pane">
            <div className="tickets-top-bar">
                {layoutPicker}
                {scopeTabs}
                {selectAllBar}
            </div>
            {recentOpened && <div className="tickets-recent-strip">{recentOpened}</div>}
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
