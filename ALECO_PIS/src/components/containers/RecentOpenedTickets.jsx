import React from 'react';
import '../../CSS/RecentOpenedTickets.css';
import '../../CSS/TicketDashboard.css';
import '../../CSS/TicketTableView.css';
import '../../CSS/TicketKanban.css';

/** Static kanban-style card (no DnD) for recent opened strip */
const RecentKanbanCard = ({ ticket, onClick, isSelected, isChecked, onToggleSelect }) => {
    const fullName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
    const location = ticket.municipality ? `${ticket.municipality}, ${ticket.district || 'Albay'}` : ticket.address || 'N/A';
    const isGroupMaster = ticket.ticket_id?.startsWith('GROUP-');
    const concernShort = (isGroupMaster ? ticket.address : ticket.concern) && (isGroupMaster ? ticket.address : ticket.concern).length > 50
        ? `${(isGroupMaster ? ticket.address : ticket.concern).substring(0, 50)}...` : (isGroupMaster ? ticket.address : ticket.concern) || 'No description';
    const createdDate = new Date(ticket.created_at);
    const diffMins = Math.floor((Date.now() - createdDate) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const timeAgo = diffMins < 60 ? `${diffMins}m ago` : diffHours < 24 ? `${diffHours}h ago` : `${diffDays}d ago`;

    return (
        <div
            className={`kanban-ticket-card ${isGroupMaster ? 'kanban-card-group' : ''} ${isSelected ? 'selected' : ''} recent-opened-kanban-card`}
            onClick={() => onClick && onClick(ticket)}
        >
            <div className="kanban-card-header">
                <div className="kanban-card-id">
                    {onToggleSelect && (
                        <input type="checkbox" className="kanban-bulk-checkbox" checked={isChecked || false} onChange={() => {}}
                            onClick={e => { e.stopPropagation(); onToggleSelect(ticket.ticket_id); }} />
                    )}
                    <span>{ticket.ticket_id}</span>
                    {isGroupMaster && (ticket.child_count ?? 0) > 0 && (
                        <span className="group-badge group-badge-parent">{ticket.child_count} ticket{(ticket.child_count ?? 0) !== 1 ? 's' : ''}</span>
                    )}
                </div>
                <div className="kanban-card-category">{ticket.category}</div>
            </div>
            <div className="kanban-card-body">
                <div className="kanban-card-name">{isGroupMaster ? 'Group' : (fullName || 'N/A')}</div>
                <div className="kanban-card-concern" title={ticket.concern}>{concernShort}</div>
            </div>
            <div className="kanban-card-footer">
                <div className="kanban-card-location" title={location}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{location.length > 20 ? `${location.substring(0, 20)}...` : location}</span>
                </div>
                <div className="kanban-card-time">⏰ {timeAgo}</div>
            </div>
        </div>
    );
};

/**
 * RecentOpenedTickets - Lego brick for displaying tickets the user recently opened
 * Supports grid, table, and kanban layouts. Helps users track what they viewed.
 */
const RecentOpenedTickets = ({
    layout,
    tickets,
    recentIds,
    timeRange,
    onTimeRangeChange,
    selectedTicket,
    onSelectTicket,
    selectedIds,
    onToggleSelect,
    onUpdateTicket,
    isCollapsed,
    onToggleCollapse
}) => {
    const recentTickets = recentIds.length > 0
        ? recentIds
            .map(id => tickets.find(t => t.ticket_id === id))
            .filter(Boolean)
        : [];

    if (recentTickets.length === 0) return null;

    const renderGridCards = () => (
        <div className="ticket-grid-wrapper recent-opened-grid">
            {recentTickets.map(ticket => {
                const isGroupMaster = ticket.ticket_id?.startsWith('GROUP-');
                return (
                    <div
                        key={ticket.ticket_id}
                        className={`ticket-card-container ${isGroupMaster ? 'ticket-card-group' : ''} ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''} recent-opened-card`}
                        onClick={() => onSelectTicket(ticket)}
                    >
                        <div className="ticket-category-banner">
                            <input
                                type="checkbox"
                                className="ticket-bulk-checkbox"
                                checked={selectedIds?.includes(ticket.ticket_id)}
                                onChange={() => {}}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect(ticket.ticket_id);
                                }}
                            />
                            <span className="banner-category-text">{ticket.category}</span>
                        </div>
                        <div className="card-header-row">
                            <span className="ticket-id-bold">{ticket.ticket_id}</span>
                            {isGroupMaster && (ticket.child_count ?? 0) > 0 && (
                                <span className="group-badge group-badge-parent">{ticket.child_count} ticket{(ticket.child_count ?? 0) !== 1 ? 's' : ''}</span>
                            )}
                            <span className="ticket-date-label">
                                {new Date(ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="card-body-content">
                            <p className="concern-text-highlight">{isGroupMaster ? (ticket.address || ticket.concern) : ticket.concern}</p>
                        </div>
                        <div className="card-footer-metadata">
                            <div className="location-scroll-wrapper">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span className="location-text-full">
                                    {ticket.municipality ? `${ticket.municipality}, ${ticket.district || 'Albay'}` : ticket.address || '—'}
                                </span>
                            </div>
                            <span className={`status-pill-solid ${(ticket.status || 'pending').toLowerCase().replace(/\s/g, '')}`}>{ticket.status || 'Pending'}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderTable = () => (
        <div className="recent-opened-table-wrap">
            <table className="ticket-table recent-opened-table">
                <thead>
                    <tr>
                        <th className="col-checkbox">
                            <input type="checkbox" disabled onChange={() => {}} />
                        </th>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Concern</th>
                        <th>Location</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {recentTickets.map(ticket => {
                        const isGroupMaster = ticket.ticket_id?.startsWith('GROUP-');
                        const fullName = isGroupMaster ? 'Group' : `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
                        const location = ticket.municipality ? `${ticket.municipality}, ${ticket.district || 'Albay'}` : ticket.address || 'N/A';
                        const concern = (isGroupMaster ? ticket.address : ticket.concern) || 'N/A';
                        const concernShort = concern.length > 40 ? `${concern.substring(0, 40)}...` : concern;
                        return (
                            <tr
                                key={ticket.ticket_id}
                                className={`ticket-table-row ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''} ${isGroupMaster ? 'ticket-row-group' : ''}`}
                                onClick={() => onSelectTicket(ticket)}
                            >
                                <td className="col-checkbox" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds?.includes(ticket.ticket_id)}
                                        onChange={() => {}}
                                        onClick={e => { e.stopPropagation(); onToggleSelect(ticket.ticket_id); }}
                                    />
                                </td>
                                <td className="col-id">
                                    {ticket.ticket_id}
                                    {isGroupMaster && (ticket.child_count ?? 0) > 0 && (
                                        <span className="group-badge group-badge-parent">{ticket.child_count} ticket{(ticket.child_count ?? 0) !== 1 ? 's' : ''}</span>
                                    )}
                                </td>
                                <td>{fullName || 'N/A'}</td>
                                <td>{ticket.category || 'N/A'}</td>
                                <td className="col-concern" title={concern}>{concernShort}</td>
                                <td>{location}</td>
                                <td>
                                    <span className={`status-badge ${(ticket.status || 'pending').toLowerCase().replace(/\s/g, '')}`}>{ticket.status || 'Pending'}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderKanban = () => (
        <div className="recent-opened-kanban-strip">
            {recentTickets.map(ticket => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                const isChecked = selectedIds?.includes(ticket.ticket_id);
                return (
                    <div key={ticket.ticket_id} className="recent-opened-kanban-card-wrap">
                        <RecentKanbanCard
                            ticket={ticket}
                            onClick={onSelectTicket}
                            isSelected={isSelected}
                            isChecked={isChecked}
                            onToggleSelect={onToggleSelect}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={`recent-opened-tickets-wrapper ${isCollapsed ? 'recent-opened-collapsed' : ''}`}>
            <div className="recent-opened-header" onClick={onToggleCollapse}>
                <span className="recent-opened-icon">🕐</span>
                <h3 className="recent-opened-title">Recent Opened Tickets ({recentTickets.length})</h3>
                <div className="recent-opened-time-range" onClick={e => e.stopPropagation()}>
                    <label>Time range:</label>
                    <select value={timeRange} onChange={e => onTimeRangeChange(e.target.value)}>
                        <option value="0.25">Past 15 mins</option>
                        <option value="1">Past 1 hour</option>
                        <option value="7">Past 7 hours</option>
                        <option value="24">Past 1 day</option>
                    </select>
                </div>
                <button type="button" className="recent-opened-collapse-btn" onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                    {isCollapsed ? '▶' : '▼'}
                </button>
            </div>
            {!isCollapsed && (
                <>
                    {layout === 'grid' && renderGridCards()}
                    {layout === 'table' && renderTable()}
                    {layout === 'kanban' && renderKanban()}
                </>
            )}
        </div>
    );
};

export default RecentOpenedTickets;
