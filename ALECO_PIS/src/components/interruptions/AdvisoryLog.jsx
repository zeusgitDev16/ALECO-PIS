import React from 'react';
import { formatToPhilippineTime } from '../../utils/dateUtils';

/**
 * Read-only audit trail for an advisory.
 * @param {object} props
 * @param {object[]} props.updates - Updates from API (id, remark, kind, actorEmail, actorName, createdAt)
 * @param {string|null} [props.createdAt] - Advisory created_at (for ordering)
 * @param {string|null} [props.deletedAt] - Advisory deleted_at (synthetic "Archived" entry)
 */
export default function AdvisoryLog({ updates = [], createdAt = null, deletedAt = null }) {
  const getActor = (u) => {
    if (u.kind === 'system') return 'System';
    return u.actorName || u.actorEmail || 'Staff';
  };

  const entries = [];
  const seen = new Set();

  if (createdAt) {
    const firstSystem = (updates || []).find((u) => u.kind === 'system' && /Advisory published by/i.test(u.remark || ''));
    if (firstSystem) {
      const createdBy = firstSystem.actorName || firstSystem.actorEmail || 'Staff';
      entries.push({
        id: `created-${firstSystem.id}`,
        createdAt: firstSystem.createdAt || createdAt,
        actor: createdBy,
        remark: 'Advisory published',
      });
      seen.add(firstSystem.id);
    }
  }

  (updates || []).forEach((u) => {
    if (seen.has(u.id)) return;
    seen.add(u.id);
    entries.push({
      id: u.id,
      createdAt: u.createdAt,
      actor: getActor(u),
      remark: u.remark || '',
    });
  });

  if (deletedAt) {
    entries.push({
      id: 'archived',
      createdAt: deletedAt,
      actor: 'System',
      remark: 'Advisory archived',
    });
  }

  entries.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  if (entries.length === 0) {
    return (
      <section className="interruptions-admin-view-section interruptions-admin-advisory-log" aria-label="Advisory log">
        <h4 className="interruptions-admin-view-section-title">Advisory Log</h4>
        <p className="interruptions-admin-view-empty">No audit entries.</p>
      </section>
    );
  }

  return (
    <section className="interruptions-admin-view-section interruptions-admin-advisory-log" aria-label="Advisory log">
      <h4 className="interruptions-admin-view-section-title">Advisory Log</h4>
      <ul className="interruptions-admin-advisory-log-list">
        {entries.map((e) => (
          <li key={e.id} className="interruptions-admin-advisory-log-entry">
            <span className="interruptions-admin-advisory-log-time">
              {e.createdAt ? formatToPhilippineTime(e.createdAt) : '—'}
            </span>
            <span className="interruptions-admin-advisory-log-sep" aria-hidden="true">
              |
            </span>
            <span className="interruptions-admin-advisory-log-actor">{e.actor}</span>
            <span className="interruptions-admin-advisory-log-sep" aria-hidden="true">
              |
            </span>
            <span className="interruptions-admin-advisory-log-remark">{e.remark}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
