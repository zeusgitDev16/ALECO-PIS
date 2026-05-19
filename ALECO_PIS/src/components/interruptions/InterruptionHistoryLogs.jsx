import React, { useState, useEffect } from 'react';
import { formatToPhilippineTime, formatPhilippineWallClock } from '../../utils/dateUtils';
import { authFetch } from '../../utils/authFetch';
import { apiUrl } from '../../utils/api';

/**
 * InterruptionHistoryLogs - Displays interruption audit/history timeline.
 * Fetches from GET /api/interruptions/:interruptionId/logs
 */
const InterruptionHistoryLogs = ({ interruptionId, isVisible }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isVisible || !interruptionId) return;

    let cancelled = false;
    async function fetchLogs() {
      try {
        setLoading(true);
        const res = await authFetch(apiUrl(`/api/interruptions/${interruptionId}/logs`));
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Failed to fetch logs');
        if (!cancelled) setLogs(json?.data || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Error loading logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => { cancelled = true; };
  }, [interruptionId, isVisible]);

  function formatDate(dt) {
    if (!dt) return '';
    try {
      return formatToPhilippineTime(dt);
    } catch {
      return dt;
    }
  }

  function getActionLabel(log) {
    if (log.action === 'update' && log.field_changed) {
      const label = FIELD_LABELS[log.field_changed] || log.field_changed;
      return `Updated: ${label}`;
    }
    const labels = {
      create: 'Created advisory',
      update: 'Updated field',
      delete: 'Archived advisory',
      restore: 'Restored advisory',
      status_change: `Status changed: ${log.from_status || '—'} → ${log.to_status || '—'}`,
      pull_feed: 'Pulled from public feed',
      push_feed: 'Pushed to public feed',
      generate_poster: 'Generated poster image',
    };
    return labels[log.action] || log.action;
  }

  function getActorDisplay(log) {
    return log.actor_name || log.actor_email || 'System';
  }

  const DATETIME_FIELDS = new Set([
    'dateTimeStart', 'dateTimeEndEstimated', 'dateTimeRestored',
    'scheduledRestoreAt', 'publicVisibleAt',
  ]);

  function formatFieldValue(field, val) {
    if (val == null || String(val).trim() === '') return '—';
    if (DATETIME_FIELDS.has(field)) {
      try {
        return formatPhilippineWallClock(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  const FIELD_LABELS = {
    type: 'Type',
    status: 'Status',
    feeder: 'Feeder',
    controlNo: 'Control No.',
    cause: 'Cause',
    causeCategory: 'Cause Category',
    dateTimeStart: 'Date/Time Start',
    dateTimeEndEstimated: 'ERT',
    dateTimeRestored: 'Date/Time Restored',
    substationRecloser: 'Substation/Recloser',
    indicationMagnitude: 'Indication/Magnitude',
    possibleFaultLocation: 'Possible Fault Location',
    linemenOnDuty: 'Linemen on Duty',
    scheduledRestoreAt: 'Scheduled Restore',
    scheduledRestoreRemark: 'Scheduled Remark',
    publicVisibleAt: 'Public Visible At',
  };

  function getMetadataSummary(log) {
    if (log.action === 'update' && log.field_changed) {
      const oldDisplay = formatFieldValue(log.field_changed, log.old_value);
      const newDisplay = formatFieldValue(log.field_changed, log.new_value);
      return `${oldDisplay} → ${newDisplay}`;
    }
    if (log.metadata?.remark) {
      return `Remark: ${log.metadata.remark}`;
    }
    return null;
  }

  if (loading) {
    return (
      <div className="interruption-history-logs">
        <p className="interruption-history-loading">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interruption-history-logs">
        <p className="interruption-history-error">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="interruption-history-logs">
        <p className="interruption-history-empty">No history yet.</p>
      </div>
    );
  }

  return (
    <div className="interruption-history-logs">
      <div className="interruption-history-timeline">
        {logs.map((log) => (
          <div key={log.id} className="interruption-history-item">
            <div className="interruption-history-dot" />
            <div className="interruption-history-content">
              <div className="interruption-history-label">{getActionLabel(log)}</div>
              <div className="interruption-history-meta">
                <span className="interruption-history-actor">{getActorDisplay(log)}</span>
                <span className="interruption-history-date">{formatDate(log.created_at)}</span>
              </div>
              {getMetadataSummary(log) && (
                <div className="interruption-history-detail">{getMetadataSummary(log)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterruptionHistoryLogs;
