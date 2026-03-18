import React from 'react';
import '../../CSS/TicketSelectAllBar.css';

const TicketSelectAllBar = ({ tickets, selectedIds, setSelectedIds }) => {
    if (!tickets || tickets.length === 0) return null;

    const isAllVisibleSelected = selectedIds.length === tickets.length;

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(tickets.map(t => t.ticket_id));
        }
    };

    return (
        <div className={`ticket-select-all-bar ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
            <label className="ticket-select-all-label">
                <input
                    type="checkbox"
                    className="ticket-select-all-checkbox"
                    checked={isAllVisibleSelected}
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
