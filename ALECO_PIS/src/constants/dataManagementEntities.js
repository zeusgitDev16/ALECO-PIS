export const DATA_MANAGEMENT_ENTITIES = [
    { id: 'tickets', label: 'Tickets', icon: '📋', available: true },
    { id: 'interruptions', label: 'Interruptions', icon: '⚡', available: true },
    { id: 'service_memos', label: 'Service Memos', icon: '📝', available: true },
    { id: 'users', label: 'Users', icon: '👥', available: true },
    { id: 'history', label: 'History', icon: '🕐', available: true },
    { id: 'personnel', label: 'Personnel', icon: '👷', available: true },
];

/** Short copy for the Export card / compact panel (entity-aware). */
export function getDataManagementExportDescription(entityId) {
    const map = {
        tickets: 'Download tickets as Excel or CSV.',
        interruptions: 'Download power advisories as Excel or CSV.',
        service_memos: 'Download service memos as Excel or CSV.',
        users: 'Download users as Excel or CSV.',
        history: 'Download unified system history as Excel or CSV.',
        personnel: 'Download crews, linemen, and crew assignments as Excel or CSV.',
    };
    return map[entityId] || 'Download data as Excel or CSV.';
}
