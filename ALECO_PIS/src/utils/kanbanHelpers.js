/**
 * Kanban Helper Utilities
 * Provides ticket grouping, statistics, and data transformation for Kanban view
 */

/**
 * Group tickets by their status
 * @param {Array} tickets - Array of ticket objects
 * @returns {Object} Tickets grouped by status (pending, ongoing, resolved, unresolved)
 */
export const groupTicketsByStatus = (tickets) => {
    // Idempotent guard - ensure tickets is always an array
    const safeTickets = Array.isArray(tickets) ? tickets : [];

    return {
        pending: safeTickets.filter(t => t.status === 'Pending'),
        ongoing: safeTickets.filter(t => t.status === 'Ongoing' || t.status === 'OnHold'),
        restored: safeTickets.filter(t => t.status === 'Restored'),
        unresolved: safeTickets.filter(t => t.status === 'Unresolved'),
        nofaultfound: safeTickets.filter(t => t.status === 'NoFaultFound'),
        accessdenied: safeTickets.filter(t => t.status === 'AccessDenied')
    };
};

/**
 * Calculate statistics for each column
 * @param {Array} tickets - Array of ticket objects
 * @returns {Object} Statistics for each status column
 */
export const getColumnStats = (tickets) => {
    const grouped = groupTicketsByStatus(tickets);

    return {
        pending: {
            count: grouped.pending.length,
            urgent: grouped.pending.filter(t => t.is_urgent === 1 || t.is_urgent === true).length
        },
        ongoing: {
            count: grouped.ongoing.length,
            urgent: grouped.ongoing.filter(t => t.is_urgent === 1 || t.is_urgent === true).length
        },
        restored: {
            count: grouped.restored.length,
            urgent: 0
        },
        unresolved: {
            count: grouped.unresolved.length,
            urgent: grouped.unresolved.filter(t => t.is_urgent === 1 || t.is_urgent === true).length
        },
        nofaultfound: { count: grouped.nofaultfound.length, urgent: 0 },
        accessdenied: { count: grouped.accessdenied.length, urgent: 0 }
    };
};

/**
 * Get column configuration with colors and labels
 * @returns {Object} Column configuration for each status
 */
export const getColumnConfig = () => {
    return {
        pending: {
            id: 'pending',
            title: 'Pending',
            status: 'Pending',
            color: '#f59e0b', // Yellow/Amber
            icon: '⏳',
            description: 'Not yet being processed'
        },
        ongoing: {
            id: 'ongoing',
            title: 'Ongoing',
            status: 'Ongoing',
            color: '#3b82f6', // Blue
            icon: '⚡',
            description: 'Currently being processed'
        },
        restored: {
            id: 'restored',
            title: 'Restored',
            status: 'Restored',
            color: '#10b981', // Green
            icon: '✓',
            description: 'Power restored / closed'
        },
        unresolved: {
            id: 'unresolved',
            title: 'Unresolved',
            status: 'Unresolved',
            color: '#ef4444', // Red
            icon: '✗',
            description: 'Processed but failed'
        },
        nofaultfound: {
            id: 'nofaultfound',
            title: 'No Fault Found',
            status: 'NoFaultFound',
            color: '#8b5cf6', // Purple
            icon: '○',
            description: 'Crew checked, no issue at site'
        },
        accessdenied: {
            id: 'accessdenied',
            title: 'Access Denied',
            status: 'AccessDenied',
            color: '#f97316', // Orange
            icon: '🚫',
            description: 'Consumer not home / cannot access'
        }
    };
};

/**
 * Format ticket data for Kanban card display
 * @param {Object} ticket - Ticket object
 * @returns {Object} Formatted ticket data
 */
export const formatTicketForCard = (ticket) => {
    const fullName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
    const location = ticket.municipality
        ? `${ticket.municipality}, ${ticket.district || 'Albay'}`
        : ticket.address || 'Location not specified';

    // Calculate time ago
    const createdDate = new Date(ticket.created_at);
    const now = new Date();
    const diffMs = now - createdDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo;
    if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
    } else {
        timeAgo = `${diffDays}d ago`;
    }

    return {
        id: ticket.ticket_id,
        ticketId: ticket.ticket_id,
        name: fullName || 'N/A',
        phone: ticket.phone_number || 'N/A',
        category: ticket.category || 'N/A',
        concern: ticket.concern || 'No description',
        concernShort: ticket.concern && ticket.concern.length > 60
            ? `${ticket.concern.substring(0, 60)}...`
            : ticket.concern || 'No description',
        location,
        locationShort: location.length > 30 ? `${location.substring(0, 30)}...` : location,
        status: ticket.status || 'Pending',
        isUrgent: ticket.is_urgent === 1 || ticket.is_urgent === true,
        createdAt: ticket.created_at,
        timeAgo,
        crewName: ticket.crew_name || null,
        dispatchedAt: ticket.dispatched_at || null
    };
};

/**
 * Sort tickets within a column
 * @param {Array} tickets - Array of tickets
 * @param {String} sortBy - Sort field (urgent, date, category)
 * @returns {Array} Sorted tickets
 */
export const sortTickets = (tickets, sortBy = 'urgent') => {
    const sorted = [...tickets];

    switch (sortBy) {
        case 'urgent':
            // Urgent first, then by date (newest first)
            return sorted.sort((a, b) => {
                const aUrgent = a.is_urgent === 1 || a.is_urgent === true;
                const bUrgent = b.is_urgent === 1 || b.is_urgent === true;
                if (aUrgent && !bUrgent) return -1;
                if (!aUrgent && bUrgent) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
        case 'date':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'category':
            return sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        default:
            return sorted;
    }
};

