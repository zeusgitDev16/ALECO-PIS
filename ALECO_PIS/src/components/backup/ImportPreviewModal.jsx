import React, { useMemo, useState } from 'react';
import '../../CSS/DispatchTicketModal.css';
import '../../CSS/TicketTableView.css';
import '../../CSS/Backup.css';

const IMPORTABLE_COLUMNS = ['ticket_id', 'customer_name', 'category', 'status', 'municipality'];
const INVALID_COLUMNS = ['rowNumber', 'ticket_id', 'reason'];

const ImportPreviewModal = ({ isOpen, onClose, preview }) => {
    const [activeTab, setActiveTab] = useState('importable');

    const importable = useMemo(() => preview?.importableTickets || [], [preview]);
    const existing = useMemo(() => preview?.existingTickets || [], [preview]);
    const invalid = useMemo(() => preview?.invalidRows || [], [preview]);

    if (!isOpen) return null;

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="export-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">&times;</button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">Import Preview</h2>
                    <p className="dispatch-modal-subtitle">
                        To restore: {Number(preview?.toImport || 0)} | Exists: {Number(preview?.skipped || 0)} | Invalid: {Number(preview?.failed || 0)}
                    </p>
                </div>

                <div className="export-preview-tabs">
                    <button
                        type="button"
                        className={`export-preview-tab ${activeTab === 'importable' ? 'active' : ''}`}
                        onClick={() => setActiveTab('importable')}
                    >
                        Importable ({importable.length})
                    </button>
                    <button
                        type="button"
                        className={`export-preview-tab ${activeTab === 'exists' ? 'active' : ''}`}
                        onClick={() => setActiveTab('exists')}
                    >
                        Exists ({existing.length})
                    </button>
                    <button
                        type="button"
                        className={`export-preview-tab ${activeTab === 'invalid' ? 'active' : ''}`}
                        onClick={() => setActiveTab('invalid')}
                    >
                        Invalid ({invalid.length})
                    </button>
                </div>

                <div className="export-preview-table-wrap">
                    {activeTab === 'importable' && (
                        importable.length === 0 ? (
                            <p className="export-preview-empty">No missing tickets to restore.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {IMPORTABLE_COLUMNS.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}
                                            <th>result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importable.map((row, i) => (
                                            <tr key={`${row.ticket_id}-${i}`}>
                                                {IMPORTABLE_COLUMNS.map((col) => <td key={col}>{row[col] ?? '—'}</td>)}
                                                <td>
                                                    <span className="import-preview-tag import-preview-tag--ok">✓ Importable</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'exists' && (
                        existing.length === 0 ? (
                            <p className="export-preview-empty">No duplicate existing ticket IDs found.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {IMPORTABLE_COLUMNS.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}
                                            <th>result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existing.map((row, i) => (
                                            <tr key={`${row.ticket_id}-${i}`}>
                                                {IMPORTABLE_COLUMNS.map((col) => <td key={col}>{row[col] ?? '—'}</td>)}
                                                <td>
                                                    <span className="import-preview-tag import-preview-tag--exists">Exists</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'invalid' && (
                        invalid.length === 0 ? (
                            <p className="export-preview-empty">No invalid rows found.</p>
                        ) : (
                            <div className="export-preview-scroll">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            {INVALID_COLUMNS.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invalid.map((row, i) => (
                                            <tr key={`${row.rowNumber}-${row.ticket_id}-${i}`}>
                                                {INVALID_COLUMNS.map((col) => <td key={col}>{row[col] ?? '—'}</td>)}
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

export default ImportPreviewModal;
