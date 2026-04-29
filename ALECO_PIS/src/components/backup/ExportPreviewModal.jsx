import React, { useState, useEffect } from 'react';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import '../../CSS/DispatchTicketModal.css';
import '../../CSS/TicketTableView.css';
import '../../CSS/Backup.css';

const TICKET_COLUMNS = ['ticket_id', 'first_name', 'last_name', 'phone_number', 'category', 'concern', 'status', 'created_at'];
const LOG_COLUMNS = ['id', 'ticket_id', 'action', 'from_status', 'to_status', 'actor_type', 'created_at'];
const INTERRUPTION_COLUMNS = ['id', 'type', 'status', 'feeder', 'cause', 'date_time_start', 'created_at'];
const INTERRUPTION_UPDATE_COLUMNS = ['id', 'interruption_id', 'remark', 'kind', 'actor_email', 'actor_name', 'created_at'];
const USER_COLUMNS = ['id', 'name', 'email', 'role', 'status', 'created_at'];
const PERSONNEL_CREW_COLUMNS = ['id', 'crew_name', 'lead_lineman', 'phone_number', 'status', 'created_at'];
const PERSONNEL_CREW_MEMBER_COLUMNS = ['crew_id', 'lineman_id'];
const PERSONNEL_LINEMEN_COLUMNS = ['id', 'full_name', 'designation', 'contact_no', 'status', 'leave_start', 'leave_end', 'leave_reason'];

const formatDate = (d) => {
    if (!d) return '—';
    return formatToPhilippineTime(d);
};

function defaultTabForEntity(entity) {
    if (entity === 'interruptions') return 'interruptions';
    if (entity === 'users') return 'users';
    if (entity === 'personnel') return 'crews';
    return 'tickets';
}

function previewSubtitle(entity, metadata) {
    if (entity === 'interruptions') {
        return `${metadata.interruptionCount ?? 0} advisories, ${metadata.updateCount ?? 0} updates`;
    }
    if (entity === 'users') {
        return `${metadata.userCount ?? 0} users`;
    }
    if (entity === 'personnel') {
        return `${metadata.crewCount ?? 0} crews, ${metadata.crewMemberCount ?? 0} member rows, ${metadata.linemanCount ?? 0} linemen`;
    }
    return `${metadata.ticketCount} tickets, ${metadata.logCount} logs`;
}

const ExportPreviewModal = ({ isOpen, onClose, data, entity = 'tickets', title = 'Export Preview' }) => {
    const [activeTab, setActiveTab] = useState(() => defaultTabForEntity(entity));

    useEffect(() => {
        setActiveTab(defaultTabForEntity(entity));
    }, [entity]);

    if (!isOpen) return null;

    const metadata = data?.metadata || {};
    const tickets = data?.tickets || [];
    const logs = data?.logs || [];
    const interruptions = data?.interruptions || [];
    const updates = data?.updates || [];
    const users = data?.users || [];
    const crews = data?.crews || [];
    const crewMembers = data?.crewMembers || [];
    const linemen = data?.linemen || [];

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="export-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">{title}</h2>
                    <p className="dispatch-modal-subtitle">
                        {metadata.dateStart} to {metadata.dateEnd} — {previewSubtitle(entity, metadata)}
                        {entity === 'tickets' && Number(metadata.blockedGroupedCount || 0) > 0
                            ? ` | Blocked grouped: ${metadata.blockedGroupedCount}`
                            : ''}
                    </p>
                </div>

                <div className="export-preview-tabs">
                    {entity === 'interruptions' && (
                        <>
                            <button
                                type="button"
                                className={`export-preview-tab ${activeTab === 'interruptions' ? 'active' : ''}`}
                                onClick={() => setActiveTab('interruptions')}
                            >
                                Interruptions ({interruptions.length})
                            </button>
                            <button
                                type="button"
                                className={`export-preview-tab ${activeTab === 'updates' ? 'active' : ''}`}
                                onClick={() => setActiveTab('updates')}
                            >
                                Updates ({updates.length})
                            </button>
                        </>
                    )}
                    {entity === 'tickets' && (
                        <>
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
                        </>
                    )}
                    {entity === 'users' && (
                        <button
                            type="button"
                            className={`export-preview-tab ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            Users ({users.length})
                        </button>
                    )}
                    {entity === 'personnel' && (
                        <>
                            <button
                                type="button"
                                className={`export-preview-tab ${activeTab === 'crews' ? 'active' : ''}`}
                                onClick={() => setActiveTab('crews')}
                            >
                                Crews ({crews.length})
                            </button>
                            <button
                                type="button"
                                className={`export-preview-tab ${activeTab === 'crewMembers' ? 'active' : ''}`}
                                onClick={() => setActiveTab('crewMembers')}
                            >
                                Crew members ({crewMembers.length})
                            </button>
                            <button
                                type="button"
                                className={`export-preview-tab ${activeTab === 'linemen' ? 'active' : ''}`}
                                onClick={() => setActiveTab('linemen')}
                            >
                                Linemen ({linemen.length})
                            </button>
                        </>
                    )}
                </div>

                <div className="export-preview-table-wrap">
                    {entity === 'interruptions' && activeTab === 'interruptions' && (
                        interruptions.length === 0 ? (
                            <p className="export-preview-empty">No advisories in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {INTERRUPTION_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interruptions.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {INTERRUPTION_COLUMNS.map((col) => (
                                                    <td key={col}>
                                                        {col === 'created_at' || col === 'date_time_start'
                                                            ? formatDate(row[col])
                                                            : (row[col] ?? '—')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                    {entity === 'interruptions' && activeTab === 'updates' && (
                        updates.length === 0 ? (
                            <p className="export-preview-empty">No updates in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {INTERRUPTION_UPDATE_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {updates.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {INTERRUPTION_UPDATE_COLUMNS.map((col) => (
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
                    {entity === 'tickets' && activeTab === 'tickets' && (
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
                    {entity === 'tickets' && activeTab === 'logs' && (
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
                    {entity === 'users' && activeTab === 'users' && (
                        users.length === 0 ? (
                            <p className="export-preview-empty">No users in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {USER_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {USER_COLUMNS.map((col) => (
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
                    {entity === 'personnel' && activeTab === 'crews' && (
                        crews.length === 0 ? (
                            <p className="export-preview-empty">No crews created in this date range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {PERSONNEL_CREW_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {crews.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {PERSONNEL_CREW_COLUMNS.map((col) => (
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
                    {entity === 'personnel' && activeTab === 'crewMembers' && (
                        crewMembers.length === 0 ? (
                            <p className="export-preview-empty">No crew member rows for crews in this range.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {PERSONNEL_CREW_MEMBER_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {crewMembers.map((row, i) => (
                                            <tr key={`${row.crew_id}-${row.lineman_id}-${i}`}>
                                                {PERSONNEL_CREW_MEMBER_COLUMNS.map((col) => (
                                                    <td key={col}>{row[col] ?? '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                    {entity === 'personnel' && activeTab === 'linemen' && (
                        linemen.length === 0 ? (
                            <p className="export-preview-empty">No linemen referenced by exported crews.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {PERSONNEL_LINEMEN_COLUMNS.map((c) => (
                                                <th key={c}>{c.replace(/_/g, ' ')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linemen.map((row, i) => (
                                            <tr key={row.id || i}>
                                                {PERSONNEL_LINEMEN_COLUMNS.map((col) => (
                                                    <td key={col}>
                                                        {col === 'leave_start' || col === 'leave_end'
                                                            ? formatDate(row[col])
                                                            : (row[col] ?? '—')}
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
