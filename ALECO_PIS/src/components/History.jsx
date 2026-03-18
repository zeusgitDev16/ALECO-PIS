import React, { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/TicketTableView.css';

const getActionLabel = (log) => {
    const { action, from_status, to_status, actor_type, metadata } = log;
    if (action === 'dispatch') return 'Dispatched';
    if (action === 'group_dispatch') return 'Group dispatched';
    if (action === 'hold') return 'Put on hold';
    if (action === 'bulk_restore') return 'Bulk Restored';
    if (action === 'ticket_edit') return 'Ticket edited';
    if (action === 'ticket_deleted') return 'Ticket deleted';
    if (action === 'status_change') {
        if (from_status === 'Pending' && to_status === 'Ongoing') return 'Dispatched';
        if (to_status === 'Restored') return actor_type === 'sms_lineman' ? 'Resolved (SMS)' : 'Resolved';
        if (to_status === 'Unresolved') return 'Unresolved';
        if (to_status === 'NoFaultFound') return 'No Fault Found';
        if (to_status === 'AccessDenied') return 'Access Denied';
        return `${from_status || '—'} → ${to_status}`;
    }
    return action || '—';
};

const getActorDisplay = (log) => {
    if (log.actor_type === 'sms_lineman') {
        const kw = log.metadata?.keyword;
        return kw ? `Lineman SMS (${kw})` : 'Lineman SMS';
    }
    return log.actor_name || log.actor_email || 'System';
};

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const AdminHistory = () => {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        ticketId: '',
        actor_email: '',
        startDate: '',
        endDate: ''
    });
    const [page, setPage] = useState(0);
    const limit = 50;

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filters.ticketId) params.set('ticketId', filters.ticketId);
            if (filters.actor_email) params.set('actor_email', filters.actor_email);
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            params.set('limit', limit);
            params.set('offset', page * limit);

            const response = await fetch(apiUrl(`/api/tickets/logs?${params}`));
            const data = await response.json();

            if (response.ok && data.success) {
                setLogs(data.data || []);
                setTotal(data.total ?? 0);
            } else {
                setError(data.message || 'Failed to load logs');
            }
        } catch (err) {
            console.error('History fetch error:', err);
            setError('Failed to load history logs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filters.ticketId, filters.actor_email, filters.startDate, filters.endDate]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPage(0);
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <AdminLayout activePage="history">
            <div className="admin-page-container">
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">History Logs</h2>
                        <p className="header-subtitle">View system activity and audit trails.</p>
                    </div>
                </div>

                <div className="main-content-card">
                    <div className="history-filters" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <input
                            type="text"
                            name="ticketId"
                            placeholder="Ticket ID"
                            value={filters.ticketId}
                            onChange={handleFilterChange}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '140px' }}
                        />
                        <input
                            type="text"
                            name="actor_email"
                            placeholder="Actor email"
                            value={filters.actor_email}
                            onChange={handleFilterChange}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '180px' }}
                        />
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                        />
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                        />
                    </div>

                    {error && <div className="error-banner" style={{ marginBottom: '16px' }}>{error}</div>}

                    {loading ? (
                        <p className="widget-text">Loading history...</p>
                    ) : logs.length === 0 ? (
                        <p className="widget-text">No history logs found.</p>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Ticket</th>
                                            <th>Action</th>
                                            <th>From → To</th>
                                            <th>Actor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={log.id}>
                                                <td>{formatDate(log.created_at)}</td>
                                                <td><code>{log.ticket_id}</code></td>
                                                <td>{getActionLabel(log)}</td>
                                                <td>{log.from_status ? `${log.from_status} → ${log.to_status || '—'}` : '—'}</td>
                                                <td>{getActorDisplay(log)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
                                    <button
                                        className="btn-action btn-cancel"
                                        disabled={page === 0}
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                    >
                                        Previous
                                    </button>
                                    <span>Page {page + 1} of {totalPages} ({total} total)</span>
                                    <button
                                        className="btn-action btn-ongoing"
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminHistory;
