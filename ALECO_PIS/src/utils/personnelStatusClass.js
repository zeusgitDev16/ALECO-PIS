/**
 * Normalize crew / lineman status strings to CSS slug classes (status-*).
 * @param {string|undefined|null} raw
 * @returns {string} e.g. 'available', 'busy', 'active', 'inactive', 'leave', 'unknown'
 */
export function personnelStatusSlug(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'unknown';
  const compact = s.replace(/\s+/g, '');
  if (compact === 'available' || compact === 'busy' || compact === 'ondispatch') return compact;
  if (compact === 'active' || compact === 'inactive') return compact;
  if (compact === 'leave' || s === 'on leave' || compact === 'onleave') return 'leave';
  return compact.replace(/[^a-z0-9]/g, '') || 'unknown';
}

/**
 * Human-readable label for chip display.
 */
export function personnelStatusLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Unknown';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
