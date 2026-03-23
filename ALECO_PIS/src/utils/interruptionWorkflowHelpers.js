/**
 * Interruption Workflow Helpers - Group advisories by status
 * Statuses: Pending (Upcoming), Ongoing, Restored (Resolved)
 */

export function groupInterruptionsByStatus(items) {
  const safe = Array.isArray(items) ? items : [];
  return {
    Pending: safe.filter((i) => (i.status || 'Pending') === 'Pending'),
    Ongoing: safe.filter((i) => (i.status || '') === 'Ongoing'),
    Restored: safe.filter((i) => (i.status || '') === 'Restored'),
  };
}

export function getInterruptionColumnConfig() {
  return {
    Pending: { id: 'Pending', title: 'Upcoming', icon: '📅', color: '#f59e0b' },
    Ongoing: { id: 'Ongoing', title: 'Ongoing', icon: '⚡', color: '#3b82f6' },
    Restored: { id: 'Restored', title: 'Resolved', icon: '✓', color: '#22c55e' },
  };
}
