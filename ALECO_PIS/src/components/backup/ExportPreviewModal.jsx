import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import '../../CSS/DispatchTicketModal.css';
import '../../CSS/TicketTableView.css';
import '../../CSS/Backup.css';

const TICKET_COLUMNS = ['ticket_id', 'first_name', 'last_name', 'phone_number', 'category', 'concern', 'action_desired', 'assigned_crew', 'concern_resolution_notes', 'status', 'created_at'];
const LOG_COLUMNS = ['id', 'ticket_id', 'action', 'from_status', 'to_status', 'actor_type', 'created_at'];
const INTERRUPTION_COLUMNS = [
    'date',
    'time started',
    'time energized',
    'substation/recloser',
    'feeder',
    'caused',
    'indication & magnitude',
    'possible fault location',
    'isolated area',
    'linemen on duty',
    'remarks/reasons',
];
const INTERRUPTION_UPDATE_COLUMNS = ['id', 'interruption_id', 'remark', 'kind', 'actor_email', 'actor_name', 'created_at'];
const USER_COLUMNS = ['id', 'name', 'email', 'role', 'status', 'created_at'];
const PERSONNEL_CREW_COLUMNS = ['id', 'crew_name', 'lead_lineman', 'phone_number', 'status', 'created_at'];
const PERSONNEL_CREW_MEMBER_COLUMNS = ['crew_id', 'lineman_id'];
const PERSONNEL_LINEMEN_COLUMNS = ['id', 'full_name', 'designation', 'contact_no', 'status', 'leave_start', 'leave_end', 'leave_reason'];
const HISTORY_COLUMNS = ['createdAt', 'module', 'action', 'title', 'detail', 'actorEmail', 'actorName', 'entityId', 'entityLabel', 'severityTag'];
const MEMO_COLUMNS = ['Memo#', 'ticket_id', 'category', 'service_date', 'received_by', 'referred_to', 'memo_status', 'Action Taken', 'created_at', 'closed_at'];
const B2B_INTERACTION_COLUMNS = ['sender', 'receiver', 'message', 'replies', 'sent_at', 'reply_at', 'message_status', 'recipient_status'];

const DATE_COLS = new Set(['created_at', 'closed_at', 'service_date', 'createdAt', 'leave_start', 'leave_end', 'sent_at', 'received_at', 'reply_at']);

const STATUS_BADGE_COLS = new Set(['status', 'memo_status', 'role', 'kind', 'actor_type', 'send_status', 'message_status', 'recipient_status']);

const formatDate = (d) => {
    if (!d) return '—';
    return formatToPhilippineTime(d);
};

function colLabel(c) {
    if (c === 'Memo#') return 'Memo #';
    if (c === 'Action Taken') return 'Action Taken';
    return c.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
}

function statusClass(col, val) {
    if (!val) return '';
    const v = String(val).toLowerCase().replace(/\s+/g, '-');
    if (col === 'status') return `ep-badge ep-badge--status ep-badge--${v}`;
    if (col === 'memo_status') return `ep-badge ep-badge--memo ep-badge--${v}`;
    if (col === 'role') return `ep-badge ep-badge--role ep-badge--${v}`;
    if (col === 'kind' || col === 'actor_type') return `ep-badge ep-badge--kind ep-badge--${v}`;
    if (col === 'message_status' || col === 'recipient_status') {
        if (v === 'failed') return 'ep-badge ep-badge--status ep-badge--failed';
        if (v === 'sent' || v === 'success') return 'ep-badge ep-badge--status ep-badge--sent';
        return `ep-badge ep-badge--status ep-badge--${v}`;
    }
    return '';
}

function defaultTabForEntity(entity) {
    if (entity === 'history') return 'history';
    if (entity === 'interruptions') return 'interruptions';
    if (entity === 'users') return 'users';
    if (entity === 'personnel') return 'crews';
    if (entity === 'service_memos') return 'memos';
    if (entity === 'b2b_mail') return 'b2b_interactions';
    return 'tickets';
}

function previewStats(entity, metadata) {
    if (entity === 'interruptions') return [
        { label: 'Advisories', value: metadata.interruptionCount ?? 0 },
        { label: 'Updates', value: metadata.updateCount ?? 0 },
    ];
    if (entity === 'users') return [{ label: 'Users', value: metadata.userCount ?? 0 }];
    if (entity === 'history') return [{ label: 'Entries', value: metadata.total ?? 0 }];
    if (entity === 'personnel') return [
        { label: 'Crews', value: metadata.crewCount ?? 0 },
        { label: 'Members', value: metadata.crewMemberCount ?? 0 },
        { label: 'Linemen', value: metadata.linemanCount ?? 0 },
    ];
    if (entity === 'service_memos') return [{ label: 'Memos', value: metadata.memoCount ?? 0 }];
    if (entity === 'b2b_mail') return [
        { label: 'Interactions', value: metadata.interactionCount ?? 0 },
    ];
    return [
        { label: 'Tickets', value: metadata.ticketCount ?? 0 },
        { label: 'Logs', value: metadata.logCount ?? 0 },
        ...(Number(metadata.blockedGroupedCount || 0) > 0
            ? [{ label: 'Blocked grouped', value: metadata.blockedGroupedCount }]
            : []),
    ];
}

const ExportPreviewModal = ({ isOpen, onClose, data, entity = 'tickets', title = 'Export Preview' }) => {
    const [activeTab, setActiveTab] = useState(() => defaultTabForEntity(entity));
    const [cellPopup, setCellPopup] = useState({ open: false, text: '', top: 0, left: 0 });
    const popupRef = useRef(null);

    useEffect(() => { setActiveTab(defaultTabForEntity(entity)); }, [entity]);

    const openCellPopup = useCallback((e, value) => {
        const text = String(value ?? '—');
        if (text === '—') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const popupWidth = Math.min(380, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12));
        const top = Math.min(window.innerHeight - 12, rect.bottom + 6);
        setCellPopup({ open: true, text, left, top });
    }, []);

    const closePopup = useCallback(() => setCellPopup((p) => ({ ...p, open: false })), []);

    useEffect(() => {
        if (!cellPopup.open) return undefined;
        const onDown = (e) => { if (popupRef.current && !popupRef.current.contains(e.target)) closePopup(); };
        const onKey = (e) => { if (e.key === 'Escape') closePopup(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', closePopup, true);
        window.addEventListener('resize', closePopup);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', closePopup, true);
            window.removeEventListener('resize', closePopup);
        };
    }, [cellPopup.open, closePopup]);

    if (!isOpen) return null;

    const metadata = data?.metadata || {};
    const tickets = data?.tickets || [];
    const logs = data?.logs || [];
    const interruptions = data?.alecoInterruptions || data?.interruptions || [];
    const updates = data?.updates || [];
    const users = data?.users || [];
    const crews = data?.crews || [];
    const crewMembers = data?.crewMembers || [];
    const linemen = data?.linemen || [];
    const history = data?.history || [];
    const memos = data?.memos || [];
    const b2bInteractions = data?.interactions || [];
    const stats = previewStats(entity, metadata);

    const renderCell = (col, value) => {
        const display = DATE_COLS.has(col) ? formatDate(value) : (value ?? '—');
        const displayStr = String(display ?? '—');
        if (STATUS_BADGE_COLS.has(col) && value) {
            return <span className={statusClass(col, value)}>{displayStr}</span>;
        }
        return (
            <button
                type="button"
                className="ep-cell-trigger"
                onClick={(e) => openCellPopup(e, displayStr)}
                title={displayStr}
            >
                {displayStr}
            </button>
        );
    };

    const renderTable = (columns, rows, keyFn) => (
        <div className="ep-table-wrap">
            <table className="ep-table">
                <thead className="ep-thead">
                    <tr>
                        {columns.map((c) => (
                            <th key={c}>{colLabel(c)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={keyFn ? keyFn(row, i) : i} className={i % 2 === 0 ? 'ep-row-even' : 'ep-row-odd'}>
                            {columns.map((col) => (
                                <td key={col}>{renderCell(col, row[col])}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderEmpty = (msg) => <p className="export-preview-empty">{msg}</p>;

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="export-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                {/* ── Header ── */}
                <div className="ep-header">
                    <div className="ep-header-text">
                        <h2 className="ep-title">{title}</h2>
                        <p className="ep-date-range">{metadata.dateStart} &rarr; {metadata.dateEnd}</p>
                    </div>
                    <div className="ep-stats-row">
                        {stats.map((s) => (
                            <div key={s.label} className="ep-stat-chip">
                                <span className="ep-stat-value">{s.value}</span>
                                <span className="ep-stat-label">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="export-preview-tabs">
                    {entity === 'interruptions' && (<>
                        <button type="button" className={`export-preview-tab ${activeTab === 'interruptions' ? 'active' : ''}`} onClick={() => setActiveTab('interruptions')}>Interruptions ({interruptions.length})</button>
                        <button type="button" className={`export-preview-tab ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')}>Updates ({updates.length})</button>
                    </>)}
                    {entity === 'tickets' && (<>
                        <button type="button" className={`export-preview-tab ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Tickets ({tickets.length})</button>
                        <button type="button" className={`export-preview-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs ({logs.length})</button>
                    </>)}
                    {entity === 'users' && (
                        <button type="button" className={`export-preview-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users ({users.length})</button>
                    )}
                    {entity === 'history' && (
                        <button type="button" className={`export-preview-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History ({history.length})</button>
                    )}
                    {entity === 'service_memos' && (
                        <button type="button" className={`export-preview-tab ${activeTab === 'memos' ? 'active' : ''}`} onClick={() => setActiveTab('memos')}>Memos ({memos.length})</button>
                    )}
                    {entity === 'personnel' && (<>
                        <button type="button" className={`export-preview-tab ${activeTab === 'crews' ? 'active' : ''}`} onClick={() => setActiveTab('crews')}>Crews ({crews.length})</button>
                        <button type="button" className={`export-preview-tab ${activeTab === 'crewMembers' ? 'active' : ''}`} onClick={() => setActiveTab('crewMembers')}>Crew Members ({crewMembers.length})</button>
                        <button type="button" className={`export-preview-tab ${activeTab === 'linemen' ? 'active' : ''}`} onClick={() => setActiveTab('linemen')}>Linemen ({linemen.length})</button>
                    </>)}
                    {entity === 'b2b_mail' && (
                        <button type="button" className={`export-preview-tab ${activeTab === 'b2b_interactions' ? 'active' : ''}`} onClick={() => setActiveTab('b2b_interactions')}>Interactions ({b2bInteractions.length})</button>
                    )}
                </div>

                {/* ── Table area ── */}
                <div className="export-preview-table-wrap">
                    {entity === 'interruptions' && activeTab === 'interruptions' && (interruptions.length === 0 ? renderEmpty('No advisories in this date range.') : renderTable(INTERRUPTION_COLUMNS, interruptions, (r, i) => r.id || i))}
                    {entity === 'interruptions' && activeTab === 'updates' && (updates.length === 0 ? renderEmpty('No updates in this date range.') : renderTable(INTERRUPTION_UPDATE_COLUMNS, updates, (r, i) => r.id || i))}
                    {entity === 'tickets' && activeTab === 'tickets' && (tickets.length === 0 ? renderEmpty('No tickets in this date range.') : renderTable(TICKET_COLUMNS, tickets, (r, i) => r.ticket_id || i))}
                    {entity === 'tickets' && activeTab === 'logs' && (logs.length === 0 ? renderEmpty('No logs in this date range.') : renderTable(LOG_COLUMNS, logs, (r, i) => r.id || i))}
                    {entity === 'users' && activeTab === 'users' && (users.length === 0 ? renderEmpty('No users in this date range.') : renderTable(USER_COLUMNS, users, (r, i) => r.id || i))}
                    {entity === 'history' && activeTab === 'history' && (history.length === 0 ? renderEmpty('No history rows in this date range.') : renderTable(HISTORY_COLUMNS, history, (r, i) => r.id || i))}
                    {entity === 'service_memos' && activeTab === 'memos' && (memos.length === 0 ? renderEmpty('No service memos in this date range.') : renderTable(MEMO_COLUMNS, memos, (r, i) => r['Memo#'] || i))}
                    {entity === 'personnel' && activeTab === 'crews' && (crews.length === 0 ? renderEmpty('No crews in this date range.') : renderTable(PERSONNEL_CREW_COLUMNS, crews, (r, i) => r.id || i))}
                    {entity === 'personnel' && activeTab === 'crewMembers' && (crewMembers.length === 0 ? renderEmpty('No crew member rows for this range.') : renderTable(PERSONNEL_CREW_MEMBER_COLUMNS, crewMembers, (r, i) => `${r.crew_id}-${r.lineman_id}-${i}`))}
                    {entity === 'personnel' && activeTab === 'linemen' && (linemen.length === 0 ? renderEmpty('No linemen referenced by exported crews.') : renderTable(PERSONNEL_LINEMEN_COLUMNS, linemen, (r, i) => r.id || i))}
                    {entity === 'b2b_mail' && activeTab === 'b2b_interactions' && (b2bInteractions.length === 0 ? renderEmpty('No interactions found in the message pool.') : renderTable(B2B_INTERACTION_COLUMNS, b2bInteractions, (r, i) => i))}
                </div>

                {/* ── Footer ── */}
                <div className="export-preview-actions">
                    <span className="ep-hint">Click any cell to read its full value</span>
                    <button type="button" className="btn-action btn-cancel" onClick={onClose}>Close</button>
                </div>
            </div>

            {/* ── Cell popup ── */}
            {cellPopup.open && (
                <div
                    ref={popupRef}
                    className="ep-cell-popup"
                    style={{ top: `${cellPopup.top}px`, left: `${cellPopup.left}px` }}
                    role="dialog"
                    aria-label="Full cell value"
                >
                    {cellPopup.text}
                </div>
            )}
        </div>
    );
};

export default ExportPreviewModal;
