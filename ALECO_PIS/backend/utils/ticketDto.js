/**
 * Ticket response DTO - converts DB Philippine datetime strings to ISO UTC for frontend.
 */

import { toIsoForClient } from './interruptionsDto.js';

const DATETIME_KEYS = [
  'created_at',
  'updated_at',
  'deleted_at',
  'hold_since',
  'dispatched_at',
];

/**
 * Convert ticket row datetime fields to ISO UTC for client.
 * @param {object} row - Raw ticket row from DB
 * @returns {object} - Same row with datetime fields as ISO UTC strings
 */
export function mapTicketRowToDto(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of DATETIME_KEYS) {
    if (key in out && out[key] != null) {
      out[key] = toIsoForClient(out[key]);
    }
  }
  return out;
}
