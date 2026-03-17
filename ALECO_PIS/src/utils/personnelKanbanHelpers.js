/**
 * Personnel Kanban Helpers - Lego Brick utilities
 * Crew statuses: Available, Deployed, Offline
 * Lineman statuses: Active, Inactive
 */

export const groupCrewsByStatus = (crews) => {
    const safe = Array.isArray(crews) ? crews : [];
    return {
        available: safe.filter(c => (c.status || 'Available') === 'Available'),
        deployed: safe.filter(c => (c.status || '') === 'Deployed'),
        offline: safe.filter(c => (c.status || '') === 'Offline')
    };
};

export const groupLinemenByStatus = (linemen) => {
    const safe = Array.isArray(linemen) ? linemen : [];
    return {
        active: safe.filter(l => (l.status || 'Active') === 'Active'),
        leave: safe.filter(l => (l.status || '') === 'Leave'),
        inactive: safe.filter(l => (l.status || '') === 'Inactive')
    };
};

export const getCrewColumnConfig = () => ({
    available: { id: 'available', title: 'Available', icon: '✓', color: '#22c55e' },
    deployed: { id: 'deployed', title: 'Deployed', icon: '⚡', color: '#3b82f6' },
    offline: { id: 'offline', title: 'Offline', icon: '○', color: '#6b7280' }
});

export const getLinemanColumnConfig = () => ({
    active: { id: 'active', title: 'Active', icon: '✓', color: '#22c55e' },
    leave: { id: 'leave', title: 'On Leave', icon: '📅', color: '#f59e0b' },
    inactive: { id: 'inactive', title: 'Inactive', icon: '○', color: '#6b7280' }
});
