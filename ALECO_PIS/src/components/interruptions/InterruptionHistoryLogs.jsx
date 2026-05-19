import React, { useState, useEffect } from 'react';
import { formatToPhilippineTime } from '../../utils/dateUtils';
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

  function getMetadataSummary(log) {
    if (!log.metadata) return null;
    if (log.action === 'update' && log.field_changed) {
      return `${log.field_changed}: ${log.old_value || '—'} → ${log.new_value || '—'}`;
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
