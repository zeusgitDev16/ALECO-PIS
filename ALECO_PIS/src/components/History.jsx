import React, { useMemo, useState, useEffect, useRef } from 'react';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import { formatPhilippineWallClock } from '../utils/dateUtils';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/TicketTableView.css';
import '../CSS/History.css';

const MODULE_META = {
    tickets: { label: 'Tickets' },
    interruptions: { label: 'Interruptions' },
    personnel: { label: 'Personnel' },
    users: { label: 'Users' },
    data_management: { label: 'Data Management' },
    b2b: { label: 'B2B Mail' },
};

const ALL_MODULES = Object.keys(MODULE_META);

const formatDate = (d) => {
    if (!d) return '—';
    return formatPhilippineWallClock(d);
};

const AdminHistory = () => {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [countsByModule, setCountsByModule] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [viewMode, setViewMode] = useState('timeline');
    const [filters, setFilters] = useState({
        modules: ALL_MODULES,
        q: '',
        actor: '',
        startDate: '',
        endDate: '',
    });
    const [page, setPage] = useState(0);
    const [cellPopup, setCellPopup] = useState({ open: false, text: '', top: 0, left: 0 });
    const popupRef = useRef(null);
    const limit = 50;

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filters.modules.length) params.set('modules', filters.modules.join(','));
            if (filters.q) params.set('q', filters.q);
            if (filters.actor) params.set('actor', filters.actor);
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            params.set('limit', limit);
            params.set('page', page);

            const response = await authFetch(apiUrl(`/api/history?${params}`));
            const data = await response.json();

            if (response.ok && data.success) {
                setRows(data.data || []);
                setTotal(data.total ?? 0);
                setCountsByModule(data.countsByModule || {});
            } else {
                setError(data.message || 'Failed to load history');
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
    }, [page, filters.modules, filters.q, filters.actor, filters.startDate, filters.endDate]);

    useEffect(() => {
        if (!cellPopup.open) return undefined;

        const closePopup = () => setCellPopup((prev) => ({ ...prev, open: false }));
        const onDocumentDown = (e) => {
            if (!popupRef.current) return;
            if (!popupRef.current.contains(e.target)) closePopup();
        };
        const onEsc = (e) => {
            if (e.key === 'Escape') closePopup();
        };

        document.addEventListener('mousedown', onDocumentDown);
        document.addEventListener('keydown', onEsc);
        window.addEventListener('scroll', closePopup, true);
        window.addEventListener('resize', closePopup);

        return () => {
            document.removeEventListener('mousedown', onDocumentDown);
            document.removeEventListener('keydown', onEsc);
            window.removeEventListener('scroll', closePopup, true);
            window.removeEventListener('resize', closePopup);
        };
    }, [cellPopup.open]);

    const openCellPopup = (e, textValue) => {
        const text = String(textValue || '—');
        const rect = e.currentTarget.getBoundingClientRect();
        const popupWidth = Math.min(420, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12));
        const top = Math.min(window.innerHeight - 12, rect.bottom + 8);
        setCellPopup({ open: true, text, left, top });
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPage(0);
    };

    const toggleModule = (module) => {
        setFilters((prev) => {
            const exists = prev.modules.includes(module);
            let next = exists ? prev.modules.filter((m) => m !== module) : [...prev.modules, module];
            if (next.length === 0) next = ALL_MODULES;
            return { ...prev, modules: next };
        });
        setPage(0);
    };

    const clearFilters = () => {
        setFilters({
            modules: ALL_MODULES,
            q: '',
            actor: '',
            startDate: '',
            endDate: '',
        });
        setPage(0);
    };

    const totalPages = Math.ceil(total / limit);
    const highestModule = useMemo(() => {
        const entries = Object.entries(countsByModule || {});
        if (entries.length === 0) return null;
        entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
        const [name, value] = entries[0];
        return Number(value || 0) > 0 ? name : null;
    }, [countsByModule]);
    const activeFiltersCount = useMemo(() => {
        let n = 0;
        if (filters.modules.length !== ALL_MODULES.length) n += 1;
        if (filters.q) n += 1;
        if (filters.actor) n += 1;
        if (filters.startDate) n += 1;
        if (filters.endDate) n += 1;
        return n;
    }, [filters]);

    const renderTable = () => (
        <div className="history-table-wrap">
            <table className="ticket-table history-table">
                <tbody className="ticket-table-body history-table-body">
                    {rows.map((row, index) => (
                        <tr key={row.id} className={`ticket-table-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                            <td className="history-col-date">
                                <button type="button" className="history-cell-popup-trigger" onClick={(e) => openCellPopup(e, formatDate(row.createdAt))}>
                                    {formatDate(row.createdAt)}
                                </button>
                            </td>
                            <td className="history-col-module">
                                <span className={`history-module-badge module-${row.module}`}>{MODULE_META[row.module]?.label || row.module}</span>
                            </td>
                            <td className="history-col-action">
                                <button type="button" className="history-cell-popup-trigger" onClick={(e) => openCellPopup(e, row.title || row.action || '—')}>
                                    {row.title || row.action || '—'}
                                </button>
                            </td>
                            <td className="history-col-details">
                                <button type="button" className="history-cell-popup-trigger" onClick={(e) => openCellPopup(e, row.detail || '—')}>
                                    {row.detail || '—'}
                                </button>
                            </td>
                            <td className="history-col-actor">
                                <button type="button" className="history-cell-popup-trigger" onClick={(e) => openCellPopup(e, row.actorName || row.actorEmail || 'System')}>
                                    {row.actorName || row.actorEmail || 'System'}
                                </button>
                            </td>
                            <td className="history-col-entity">
                                <button type="button" className="history-cell-popup-trigger" onClick={(e) => openCellPopup(e, row.entityLabel || row.entityId || '—')}>
                                    {row.entityLabel || row.entityId || '—'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderTimeline = () => (
        <div className="history-timeline">
            {rows.map((row) => (
                <article key={row.id} className="history-event-card">
                    <div className="history-event-header">
                        <span className={`history-module-badge module-${row.module}`}>{MODULE_META[row.module]?.label || row.module}</span>
                        <time>{formatDate(row.createdAt)}</time>
                    </div>
                    <h4>{row.title || row.action || 'Activity'}</h4>
                    <p>{row.detail || 'No extra details.'}</p>
                    <div className="history-event-meta">
                        <span>Actor: {row.actorName || row.actorEmail || 'System'}</span>
                        <span>Entity: {row.entityLabel || row.entityId || '—'}</span>
                    </div>
                </article>
            ))}
        </div>
    );

    return (
        <AdminLayout activePage="history">
            <div className="admin-page-container">
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">System History</h2>
                        <p className="header-subtitle">Unified activity feed across tickets, interruptions, personnel, users, data management, and B2B mail.</p>
                    </div>
                </div>

                <div className="main-content-card history-main-content">

                    {/* TOP PANEL — filters & controls, never scrolls away */}
                    <div className="history-top-panel">
                        <div className="history-summary-grid">
                            {ALL_MODULES.map((module) => (
                                <button
                                    key={module}
                                    type="button"
                                    className={`history-summary-card module-${module} ${filters.modules.includes(module) ? 'active' : ''} ${highestModule === module ? 'is-top-module' : ''}`}
                                    onClick={() => toggleModule(module)}
                                >
                                    <div className="history-summary-title">{MODULE_META[module].label}</div>
                                    <div className="history-summary-count">{countsByModule[module] || 0}</div>
                                    <div className="history-summary-trend">
                                        {highestModule === module ? 'Most active module' : 'Recent activity'}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="history-filter-actions">
                            <button type="button" className="btn-action btn-cancel history-filter-toggle" onClick={() => setMobileFiltersOpen((v) => !v)}>
                                Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                            </button>
                            <div className="history-view-toggle" role="tablist" aria-label="History view mode">
                                <button type="button" className={`history-view-btn ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setViewMode('timeline')}>Timeline</button>
                                <button type="button" className={`history-view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>Table</button>
                            </div>
                        </div>

                        <div className={`history-filters-panel ${mobileFiltersOpen ? 'open' : ''}`}>
                            <input
                                type="text"
                                name="q"
                                placeholder="Search action/details/entity"
                                value={filters.q}
                                onChange={handleFilterChange}
                                className="history-filter-input"
                            />
                            <input
                                type="text"
                                name="actor"
                                placeholder="Actor email/name"
                                value={filters.actor}
                                onChange={handleFilterChange}
                                className="history-filter-input"
                            />
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="history-filter-input" />
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="history-filter-input" />
                            <button type="button" className="btn-action btn-cancel" onClick={clearFilters}>Reset</button>
                        </div>

                        {viewMode === 'table' && rows.length > 0 && (
                            <div className="history-table-col-header" role="rowgroup" aria-label="History table headers">
                                <span className="history-col-date">Date</span>
                                <span className="history-col-module">Module</span>
                                <span className="history-col-action">Action</span>
                                <span className="history-col-details">Details</span>
                                <span className="history-col-actor">Actor</span>
                                <span className="history-col-entity">Entity</span>
                            </div>
                        )}

                        {error && <div className="error-banner history-error-banner">{error}</div>}
                    </div>

                    {/* MIDDLE — scrollable list */}
                    <div className="history-list-region">
                        {loading ? (
                            <p className="widget-text">Loading history...</p>
                        ) : rows.length === 0 ? (
                            <p className="widget-text">No history logs found.</p>
                        ) : (
                            viewMode === 'timeline' ? renderTimeline() : renderTable()
                        )}
                    </div>

                    {/* FOOTER — pagination, always at the bottom */}
                    {totalPages > 1 && (
                        <div className="history-pagination-footer">
                            <div className="history-pagination">
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
                        </div>
                    )}
                </div>
                {cellPopup.open && (
                    <div
                        ref={popupRef}
                        className="history-cell-popup"
                        style={{ top: `${cellPopup.top}px`, left: `${cellPopup.left}px` }}
                        role="dialog"
                        aria-label="Full cell value"
                    >
                        {cellPopup.text}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminHistory;
