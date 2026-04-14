import React, { useState, useEffect } from 'react';
import BackupFileInput from './BackupFileInput';

const BackupCompactView = ({
    entity = 'tickets',
    format, onFormatChange,
    exporting, onExport, previewLoading, onViewInBrowser,
    archiving, onArchiveClick,
    importFile, onImportFileChange, importing, previewing, onPreview, onImport, previewResult
}) => {
    const [activeTab, setActiveTab] = useState('export');
    const ticketsOnly = entity === 'tickets';

    useEffect(() => {
        setActiveTab('export');
    }, [entity]);

    return (
        <div className="backup-compact-view">
            <div className="backup-compact-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    className={`backup-compact-tab ${activeTab === 'export' ? 'active' : ''}`}
                    onClick={() => setActiveTab('export')}
                    aria-selected={activeTab === 'export'}
                >
                    Export
                </button>
                {ticketsOnly && (
                    <>
                        <button
                            type="button"
                            role="tab"
                            className={`backup-compact-tab ${activeTab === 'archive' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archive')}
                            aria-selected={activeTab === 'archive'}
                        >
                            Archive
                        </button>
                        <button
                            type="button"
                            role="tab"
                            className={`backup-compact-tab ${activeTab === 'import' ? 'active' : ''}`}
                            onClick={() => setActiveTab('import')}
                            aria-selected={activeTab === 'import'}
                        >
                            Import
                        </button>
                    </>
                )}
            </div>
            <div className="backup-compact-panel" role="tabpanel">
                {activeTab === 'export' && (
                    <>
                        <div className="backup-compact-row">
                            <span>Format:</span>
                            <label><input type="radio" name="format" checked={format === 'excel'} onChange={() => onFormatChange('excel')} /> Excel</label>
                            <label><input type="radio" name="format" checked={format === 'csv'} onChange={() => onFormatChange('csv')} /> CSV</label>
                        </div>
                        <div className="backup-compact-actions">
                            <button className="btn-add-purple" onClick={onExport} disabled={exporting}>
                                {exporting ? 'Exporting...' : 'Download'}
                            </button>
                            <button className="btn-action btn-ongoing" onClick={onViewInBrowser} disabled={previewLoading}>
                                {previewLoading ? 'Loading...' : 'View in browser'}
                            </button>
                        </div>
                    </>
                )}
                {ticketsOnly && activeTab === 'archive' && (
                    <>
                        <p className="backup-compact-desc">Soft-delete tickets in the selected date range. Cannot be undone.</p>
                        <button className="btn-action btn-delete" onClick={onArchiveClick} disabled={archiving}>
                            {archiving ? 'Archiving...' : 'Archive exported tickets'}
                        </button>
                    </>
                )}
                {ticketsOnly && activeTab === 'import' && (
                    <>
                        <p className="backup-compact-desc">Upload Excel (.xlsx) or CSV. Preview validates before import.</p>
                        <div className="backup-compact-file-wrap">
                            <BackupFileInput
                                variant="compact"
                                importFile={importFile}
                                onImportFileChange={onImportFileChange}
                            />
                        </div>
                        <div className="backup-compact-actions">
                            <button className="btn-action btn-cancel" onClick={onPreview} disabled={!importFile || previewing}>
                                {previewing ? 'Previewing...' : 'Preview'}
                            </button>
                            <button className="btn-add-purple" onClick={onImport} disabled={!importFile || importing}>
                                {importing ? 'Importing...' : 'Import'}
                            </button>
                        </div>
                        {previewResult && (
                            <div className="backup-preview">
                                <p>Valid: {previewResult.valid} | To import: {previewResult.toImport} | Skipped: {previewResult.skipped} | Failed: {previewResult.failed}</p>
                                {previewResult.errors?.length > 0 && (
                                    <ul>
                                        {previewResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BackupCompactView;
