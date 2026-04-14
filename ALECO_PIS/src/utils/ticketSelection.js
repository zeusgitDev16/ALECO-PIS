/**
 * Shared helpers for "Select all visible" across ticket list scopes (urgent vs regular)
 * and filter drawer. Union on select; subtract only visible IDs on deselect.
 */

export function visibleIdsFromTickets(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  return tickets.map((t) => t?.ticket_id).filter(Boolean);
}

/**
 * True when every visible ticket id is in selectedIds.
 */
export function isAllVisibleSelected(visibleIds, selectedIds) {
  if (!visibleIds.length) return false;
  const set = new Set(selectedIds || []);
  return visibleIds.every((id) => set.has(id));
}

/**
 * Toggle: if all visible are selected, remove only visible ids; else union visible ids into selection.
 */
export function toggleSelectAllVisible(visibleIds, selectedIds, setSelectedIds) {
  if (!visibleIds.length) return;
  const visibleSet = new Set(visibleIds);
  if (isAllVisibleSelected(visibleIds, selectedIds)) {
    setSelectedIds((prev) => (prev || []).filter((id) => !visibleSet.has(id)));
  } else {
    setSelectedIds((prev) => {
      const next = new Set(prev || []);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }
}
