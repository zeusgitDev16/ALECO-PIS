import React from 'react';

const BackupWorkflowView = ({
    format, onFormatChange,
    exporting, onExport, previewLoading, onViewInBrowser,
    archiving, onArchiveClick,
    importFile, onImportFileChange, importing, previewing, onPreview, onImport, previewResult
}) => {
    return (
        <div className="backup-workflow">
            <div className="backup-workflow-step">
                <span className="backup-workflow-badge">1</span>
                <span className="backup-workflow-label">Date range selected above</span>
            </div>

            <div className="backup-workflow-step">
                <span className="backup-workflow-badge">2</span>
                <div className="backup-workflow-content">
                    <h4 className="backup-workflow-title">Export or Archive</h4>
                    <div className="backup-workflow-row">
                        <div className="backup-workflow-block">
                            <span className="backup-workflow-sub">Export</span>
                            <label><input type="radio" name="format" checked={format === 'excel'} onChange={() => onFormatChange('excel')} /> Excel</label>
                            <label><input type="radio" name="format" checked={format === 'csv'} onChange={() => onFormatChange('csv')} /> CSV</label>
                            <div className="backup-workflow-actions">
                                <button className="btn-add-purple" onClick={onExport} disabled={exporting}>{exporting ? '...' : 'Download'}</button>
                                <button className="btn-action btn-ongoing" onClick={onViewInBrowser} disabled={previewLoading}>{previewLoading ? '...' : 'View'}</button>
                            </div>
                        </div>
                        <div className="backup-workflow-block">
                            <span className="backup-workflow-sub">Archive</span>
                            <button className="btn-action btn-delete" onClick={onArchiveClick} disabled={archiving}>
                                {archiving ? '...' : 'Archive'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="backup-workflow-step">
                <span className="backup-workflow-badge">3</span>
                <div className="backup-workflow-content">
                    <h4 className="backup-workflow-title">Import</h4>
                    <input type="file" accept=".xlsx,.csv" onChange={(e) => onImportFileChange(e.target.files?.[0] || null)} className="backup-workflow-file" />
                    <div className="backup-workflow-actions">
                        <button className="btn-action btn-cancel" onClick={onPreview} disabled={!importFile || previewing}>{previewing ? '...' : 'Preview'}</button>
                        <button className="btn-add-purple" onClick={onImport} disabled={!importFile || importing}>{importing ? '...' : 'Import'}</button>
                    </div>
                    {previewResult && (
                        <div className="backup-preview">
                            <p>Valid: {previewResult.valid} | Import: {previewResult.toImport} | Skipped: {previewResult.skipped}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupWorkflowView;
