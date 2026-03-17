import React, { useState, useEffect } from 'react';

/**
 * TicketHistoryLogs - Displays ticket audit/history timeline.
 * Fetches from GET /api/tickets/:ticketId/logs and renders human-readable entries.
 */
const TicketHistoryLogs = ({ ticketId, isVisible }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!ticketId || !isVisible) {
            if (!ticketId) setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        fetch(`http://localhost:5000/api/tickets/${ticketId}/logs`)
            .then(res => {
                const ct = res.headers.get('content-type');
                if (!ct || !ct.includes('application/json')) {
                    return res.text().then(t => { throw new Error(`Server returned ${res.status}: ${t?.slice(0,100) || 'non-JSON'}`); });
                }
                return res.json();
            })
            .then(data => {
                if (data.success) setLogs(data.data || []);
                else setError(data.message || 'Failed to load logs');
            })
            .catch(err => {
                setError(err?.message || 'Failed to load logs');
                setLogs([]);
            })
            .finally(() => setLoading(false));
    }, [ticketId, isVisible]);

    const formatDate = (d) => {
        if (!d) return '—';
        const dt = new Date(d);
        return dt.toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionLabel = (log) => {
        const { action, from_status, to_status, actor_type, metadata } = log;
        if (action === 'dispatch') return 'Started resolution / Dispatched';
        if (action === 'group_dispatch') return 'Group dispatched';
        if (action === 'hold') return 'Put on hold';
        if (action === 'bulk_restore') return 'Marked as Restored (bulk)';
        if (action === 'status_change') {
            if (from_status === 'Pending' && to_status === 'Ongoing') return 'Dispatched';
            if (to_status === 'Restored') return actor_type === 'sms_lineman' ? 'Resolved (via lineman SMS)' : 'Resolved (manual)';
            if (to_status === 'Unresolved') return 'Marked Unresolved';
            if (to_status === 'NoFaultFound') return 'No Fault Found';
            if (to_status === 'AccessDenied') return 'Access Denied';
            return `Status: ${from_status || '—'} → ${to_status}`;
        }
        return action;
    };

    const getActorDisplay = (log) => {
        if (log.actor_type === 'sms_lineman') {
            const kw = log.metadata?.keyword;
            return kw ? `Lineman SMS (${kw})` : 'Lineman SMS';
        }
        return log.actor_name || log.actor_email || 'System';
    };

    const getMetadataSummary = (log) => {
        const m = log.metadata;
        if (!m) return null;
        const parts = [];
        if (m.assigned_crew) parts.push(`Crew: ${m.assigned_crew}`);
        if (m.eta) parts.push(`ETA: ${m.eta}`);
        if (m.hold_reason) parts.push(`Reason: ${m.hold_reason}`);
        if (m.dispatch_notes) parts.push(`Notes: ${m.dispatch_notes}`);
        if (m.lineman_remarks) parts.push(`Remarks: ${m.lineman_remarks}`);
        return parts.length > 0 ? parts.join(' • ') : null;
    };

    if (loading) {
        return (
            <div className="ticket-history-logs">
                <p className="ticket-history-loading">Loading history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ticket-history-logs">
                <p className="ticket-history-error">{error}</p>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="ticket-history-logs">
                <p className="ticket-history-empty">No history yet.</p>
            </div>
        );
    }

    return (
        <div className="ticket-history-logs">
            <div className="ticket-history-timeline">
                {logs.map((log) => (
                    <div key={log.id} className="ticket-history-item">
                        <div className="ticket-history-dot" />
                        <div className="ticket-history-content">
                            <div className="ticket-history-label">{getActionLabel(log)}</div>
                            <div className="ticket-history-meta">
                                <span className="ticket-history-actor">{getActorDisplay(log)}</span>
                                <span className="ticket-history-date">{formatDate(log.created_at)}</span>
                            </div>
                            {getMetadataSummary(log) && (
                                <div className="ticket-history-detail">{getMetadataSummary(log)}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TicketHistoryLogs;
