/**
 * Map API values to live MySQL ENUM literals on `aleco_interruptions`.
 * Type: older DBs may only have Scheduled | Unscheduled; newer add Emergency | NgcScheduled.
 * Status: mid-migration DBs may have Restored but not yet Energized.
 */

/**
 * @param {string|null|undefined} columnType - INFORMATION_SCHEMA.COLUMNS.COLUMN_TYPE
 * @returns {Set<string>|null} null if not a MySQL ENUM definition
 */
export function parseMysqlEnumColumnType(columnType) {
  const s = String(columnType || '').trim();
  const m = s.match(/^enum\s*\((.*)\)\s*$/i);
  if (!m) return null;
  const inner = m[1];
  const values = [];
  for (const part of inner.split(',')) {
    const p = part.trim();
    const q = p.match(/^'(.*)'$/);
    if (q) values.push(String(q[1]).replace(/''/g, "'"));
  }
  return new Set(values);
}

/**
 * @param {string} apiType - Scheduled | Emergency | NgcScheduled (already validated against app enums)
 * @param {Set<string>|null} dbEnum - literals allowed by the DB column, or null to use apiType unchanged
 * @returns {{ type: string } | { error: string }}
 */
export function apiInterruptionTypeToDbLiteral(apiType, dbEnum) {
  if (!dbEnum || dbEnum.size === 0) {
    return { type: apiType };
  }
  if (dbEnum.has(apiType)) {
    return { type: apiType };
  }
  if (apiType === 'Emergency' && dbEnum.has('Unscheduled')) {
    return { type: 'Unscheduled' };
  }
  if (apiType === 'NgcScheduled' && !dbEnum.has('NgcScheduled')) {
    return {
      error:
        'This database cannot store NGCP scheduled advisories until the type column is migrated. Run: node backend/run-migration.js backend/migrations/alter_interruption_outage_type_and_energized_status.sql',
    };
  }
  if (apiType === 'CustomPoster' && !dbEnum.has('CustomPoster')) {
    return {
      error:
        'This database cannot store CustomPoster advisories until the type column is migrated. Run: node backend/run-migration.js backend/migrations/add_custom_poster_interruption_type.sql',
    };
  }
  return {
    error: `Database type ENUM does not accept "${apiType}". Apply backend/migrations/add_custom_poster_interruption_type.sql (or align ENUM with Scheduled, Emergency, NgcScheduled, CustomPoster).`,
  };
}

/**
 * @param {string} apiStatus - Pending | Ongoing | Energized
 * @param {Set<string>|null} dbEnum
 * @returns {{ status: string } | { error: string }}
 */
export function apiInterruptionStatusToDbLiteral(apiStatus, dbEnum) {
  if (!dbEnum || dbEnum.size === 0) {
    return { status: apiStatus };
  }
  if (dbEnum.has(apiStatus)) {
    return { status: apiStatus };
  }
  if (apiStatus === 'Energized' && !dbEnum.has('Energized') && dbEnum.has('Restored')) {
    return { status: 'Restored' };
  }
  return {
    error: `Database status ENUM does not accept "${apiStatus}". Apply backend/migrations/alter_interruption_outage_type_and_energized_status.sql.`,
  };
}
