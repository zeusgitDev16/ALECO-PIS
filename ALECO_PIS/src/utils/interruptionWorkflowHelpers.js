import { isInterruptionEnergizedStatus } from './interruptionLabels';

/**
 * Interruption Workflow Helpers - Group advisories by status
 * Statuses: Pending (Upcoming), Ongoing, Energized (legacy DB rows may still be Restored)
 */

export function groupInterruptionsByStatus(items) {
  const safe = Array.isArray(items) ? items : [];
  return {
    Pending: safe.filter((i) => (i.status || 'Pending') === 'Pending'),
    Ongoing: safe.filter((i) => (i.status || '') === 'Ongoing'),
    Energized: safe.filter((i) => isInterruptionEnergizedStatus(i.status)),
  };
}

export function getInterruptionColumnConfig() {
  return {
    Pending: { id: 'Pending', title: 'Upcoming', icon: '📅', color: '#f59e0b' },
    Ongoing: { id: 'Ongoing', title: 'Ongoing', icon: '⚡', color: '#3b82f6' },
    Energized: { id: 'Energized', title: 'Energized', icon: '✓', color: '#22c55e' },
  };
}
