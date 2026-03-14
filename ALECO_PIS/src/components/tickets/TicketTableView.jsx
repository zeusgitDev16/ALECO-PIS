import React, { useState, useMemo } from 'react';
import '../../CSS/TicketTableView.css';

/**
 * TicketTableView - High-performance table layout for bulk ticket operations
 * Handles 10,000+ tickets with client-side sorting and selection
 */
const TicketTableView = ({ 
    tickets, 
    selectedTicket, 
    onSelectTicket, 
    selectedIds, 
    onToggleSelect 
}) => {
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    // Idempotent guard - ensure tickets is always an array
    const safeTickets = Array.isArray(tickets) ? tickets : [];

    // Memoized sorting for performance
    const sortedTickets = useMemo(() => {
        const sorted = [...safeTickets];
        
        sorted.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle date sorting
            if (sortConfig.key === 'created_at') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }
            
            // Handle boolean sorting (is_urgent)
            if (sortConfig.key === 'is_urgent') {
                aValue = aValue ? 1 : 0;
                bValue = bValue ? 1 : 0;
            }

            // Handle string sorting (case-insensitive)
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            // Null safety
            if (aValue == null) return 1;
            if (bValue == null) return -1;

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [safeTickets, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSelectAll = () => {
        if (selectedIds.length === safeTickets.length && safeTickets.length > 0) {
            // Deselect all
            selectedIds.forEach(id => onToggleSelect(id));
        } else {
            // Select all
            safeTickets.forEach(ticket => {
                if (!selectedIds.includes(ticket.ticket_id)) {
                    onToggleSelect(ticket.ticket_id);
                }
            });
        }
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };

    // Empty state
    if (safeTickets.length === 0) {
        return (
            <div className="ticket-table-empty">
                <p>No tickets to display</p>
            </div>
        );
    }

    return (
        <div className="ticket-table-container">
            <table className="ticket-table">
                <thead className="ticket-table-header">
                    <tr>
                        <th className="col-checkbox">
                            <input
                                type="checkbox"
                                checked={selectedIds.length === safeTickets.length && safeTickets.length > 0}
                                onChange={handleSelectAll}
                                title="Select all tickets"
                            />
                        </th>
                        <th className="col-id sortable" onClick={() => handleSort('ticket_id')}>
                            Ticket ID{getSortIndicator('ticket_id')}
                        </th>
                        <th className="col-name sortable" onClick={() => handleSort('first_name')}>
                            Name{getSortIndicator('first_name')}
                        </th>
                        <th className="col-phone">Phone</th>
                        <th className="col-category sortable" onClick={() => handleSort('category')}>
                            Category{getSortIndicator('category')}
                        </th>
                        <th className="col-concern">Concern</th>
                        <th className="col-location sortable" onClick={() => handleSort('municipality')}>
                            Location{getSortIndicator('municipality')}
                        </th>
                        <th className="col-status sortable" onClick={() => handleSort('status')}>
                            Status{getSortIndicator('status')}
                        </th>
                        <th className="col-date sortable" onClick={() => handleSort('created_at')}>
                            Date{getSortIndicator('created_at')}
                        </th>
                    </tr>
                </thead>
                <tbody className="ticket-table-body">
                    {sortedTickets.map((ticket, index) => {
                        const fullName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
                        const location = ticket.municipality
                            ? `${ticket.municipality}, ${ticket.district || 'Albay'}`
                            : ticket.address || 'N/A';
                        const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                        const isChecked = selectedIds.includes(ticket.ticket_id);
                        const isUrgent = ticket.is_urgent === 1 || ticket.is_urgent === true;

                        return (
                            <tr
                                key={ticket.ticket_id}
                                className={`ticket-table-row ${isSelected ? 'selected' : ''} ${isUrgent ? 'urgent' : ''} ${index % 2 === 0 ? 'even' : 'odd'}`}
                                onClick={() => onSelectTicket(ticket)}
                            >
                                <td className="col-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleSelect(ticket.ticket_id);
                                        }}
                                    />
                                </td>
                                <td className="col-id">
                                    {isUrgent ? <strong>{ticket.ticket_id}</strong> : ticket.ticket_id}
                                </td>
                                <td className="col-name">{fullName || 'N/A'}</td>
                                <td className="col-phone">{ticket.phone_number || 'N/A'}</td>
                                <td className="col-category">{ticket.category || 'N/A'}</td>
                                <td className="col-concern" title={ticket.concern}>
                                    {ticket.concern && ticket.concern.length > 40
                                        ? `${ticket.concern.substring(0, 40)}...`
                                        : ticket.concern || 'N/A'}
                                </td>
                                <td className="col-location" title={location}>
                                    {location}
                                </td>
                                <td className="col-status">
                                    {isUrgent && <span className="urgent-dot">🔴</span>}
                                    <span className={`status-badge ${(ticket.status || 'pending').toLowerCase()}`}>
                                        {ticket.status || 'Pending'}
                                    </span>
                                </td>
                                <td className="col-date">
                                    {new Date(ticket.created_at).toLocaleDateString('en-PH', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TicketTableView;

