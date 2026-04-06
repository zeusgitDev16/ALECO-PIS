import React, { useMemo } from 'react';
import '../../CSS/TicketSelectAllBar.css';
import { visibleIdsFromTickets, isAllVisibleSelected, toggleSelectAllVisible } from '../../utils/ticketSelection';

const TicketSelectAllBar = ({ tickets, selectedIds, setSelectedIds }) => {
    if (!tickets || tickets.length === 0) return null;

    const visibleIds = useMemo(() => visibleIdsFromTickets(tickets), [tickets]);
    const allVisibleSelected = isAllVisibleSelected(visibleIds, selectedIds);

    const toggleSelectAll = () => {
        toggleSelectAllVisible(visibleIds, selectedIds, setSelectedIds);
    };

    return (
        <div className={`ticket-select-all-bar ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
            <label className="ticket-select-all-label">
                <input
                    type="checkbox"
                    className="ticket-select-all-checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                />
                <span className="ticket-select-all-text">
                    Select All
                    <span className="ticket-select-all-count">({tickets.length})</span>
                </span>
            </label>
            {selectedIds.length > 0 && (
                <button
                    type="button"
                    className="ticket-select-all-clear"
                    onClick={() => setSelectedIds([])}
                >
                    Clear ({selectedIds.length})
                </button>
            )}
        </div>
    );
};

export default TicketSelectAllBar;
