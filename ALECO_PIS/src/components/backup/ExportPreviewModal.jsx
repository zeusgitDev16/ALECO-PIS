import React, { useState } from 'react';
import '../../CSS/DispatchTicketModal.css';
import '../../CSS/TicketTableView.css';
import '../../CSS/Backup.css';

const TICKET_COLUMNS = ['ticket_id', 'first_name', 'last_name', 'phone_number', 'category', 'concern', 'status', 'created_at'];
const LOG_COLUMNS = ['id', 'ticket_id', 'action', 'from_status', 'to_status', 'actor_type', 'created_at'];

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

const ExportPreviewModal = ({ isOpen, onClose, data }) => {
    const [activeTab, setActiveTab] = useState('tickets');

    if (!isOpen) return null;

    const metadata = data?.metadata || {};
    const tickets = data?.tickets || [];
    const logs = data?.logs || [];

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="export-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">Export Preview</h2>
                    <p className="dispatch-modal-subtitle">
                        {metadata.dateStart} to {metadata.dateEnd} — {metadata.ticketCount} tickets, {metadata.logCount} logs
                    </p>
                </div>

                <div className="export-preview-tabs">
                    <button
                        type="button"
                        className={`export-preview-tab ${activeTab === 'tickets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tickets')}
                    >
                        Tickets ({tickets.length})
                    </button>
                    <button
                        type="button"
                        className={`export-preview-tab ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Logs ({logs.length})
                    </button>
                </div>

                <div className="export-preview-table-wrap">
                    {activeTab === 'tickets' && (
                        tickets.length === 0 ? (
                            <p className="export-preview-empty">No tickets in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {TICKET_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.map((row, i) => (
                                            <tr key={row.ticket_id || i}>
                                                {TICKET_COLUMNS.map((col) => (
                                                    <td key={col}>
                                                        {col === 'created_at' ? formatDate(row[col]) : (row[col] ?? '—')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                    {activeTab === 'logs' && (
                        logs.length === 0 ? (
                            <p className="export-preview-empty">No logs in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {LOG_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {LOG_COLUMNS.map((col) => (
                                                    <td key={col}>
                                                        {col === 'created_at' ? formatDate(row[col]) : (row[col] ?? '—')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>

                <div className="export-preview-actions">
                    <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportPreviewModal;
