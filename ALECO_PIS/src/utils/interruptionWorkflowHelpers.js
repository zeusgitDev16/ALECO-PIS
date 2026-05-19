import { isInterruptionEnergizedStatus } from './interruptionLabels';

/**
 * Interruption Workflow Helpers - Group advisories by status
 * Statuses: Pending (Upcoming), Ongoing, Energized, Cancelled, Rescheduled
 */

export function groupInterruptionsByStatus(items) {
  const safe = Array.isArray(items) ? items : [];
  return {
    Pending: safe.filter((i) => (i.status || 'Pending') === 'Pending'),
    Ongoing: safe.filter((i) => (i.status || '') === 'Ongoing'),
    Energized: safe.filter((i) => isInterruptionEnergizedStatus(i.status)),
    Cancelled: safe.filter((i) => i.status === 'Cancelled'),
    Rescheduled: safe.filter((i) => i.status === 'Rescheduled'),
  };
}

export function getInterruptionColumnConfig() {
  return {
    Pending: { id: 'Pending', title: 'Upcoming', icon: '📅', color: '#f59e0b' },
    Ongoing: { id: 'Ongoing', title: 'Ongoing', icon: '⚡', color: '#3b82f6' },
    Energized: { id: 'Energized', title: 'Energized', icon: '✓', color: '#22c55e' },
    Cancelled: { id: 'Cancelled', title: 'Cancelled', icon: '✗', color: '#dc2626' },
    Rescheduled: { id: 'Rescheduled', title: 'Rescheduled', icon: '🔄', color: '#f97316' },
  };
}
