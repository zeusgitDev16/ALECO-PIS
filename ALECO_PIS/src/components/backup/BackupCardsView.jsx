import React from 'react';

const BackupCardsView = ({
    format, onFormatChange,
    exporting, onExport, previewLoading, onViewInBrowser,
    archiving, onArchiveClick,
    importFile, onImportFileChange, importing, previewing, onPreview, onImport, previewResult
}) => {
    return (
        <div className="backup-cards-grid">
            <div className="backup-card">
                <div className="backup-card-icon" aria-hidden="true">↓</div>
                <h4 className="backup-card-title">Export</h4>
                <p className="backup-card-desc">Download tickets as Excel or CSV.</p>
                <div className="backup-card-row">
                    <label><input type="radio" name="format" checked={format === 'excel'} onChange={() => onFormatChange('excel')} /> Excel</label>
                    <label><input type="radio" name="format" checked={format === 'csv'} onChange={() => onFormatChange('csv')} /> CSV</label>
                </div>
                <div className="backup-card-actions">
                    <button className="btn-add-purple" onClick={onExport} disabled={exporting}>
                        {exporting ? '...' : 'Download'}
                    </button>
                    <button className="btn-action btn-ongoing" onClick={onViewInBrowser} disabled={previewLoading}>
                        {previewLoading ? '...' : 'View'}
                    </button>
                </div>
            </div>

            <div className="backup-card">
                <div className="backup-card-icon">⊟</div>
                <h4 className="backup-card-title">Archive</h4>
                <p className="backup-card-desc">Soft-delete tickets in date range.</p>
                <button className="btn-action btn-delete" onClick={onArchiveClick} disabled={archiving}>
                    {archiving ? 'Archiving...' : 'Archive'}
                </button>
            </div>

            <div className="backup-card">
                <div className="backup-card-icon" aria-hidden="true">↑</div>
                <h4 className="backup-card-title">Import</h4>
                <p className="backup-card-desc">Upload .xlsx or .csv file.</p>
                <input type="file" accept=".xlsx,.csv" onChange={(e) => onImportFileChange(e.target.files?.[0] || null)} className="backup-card-file" />
                <div className="backup-card-actions">
                    <button className="btn-action btn-cancel" onClick={onPreview} disabled={!importFile || previewing}>
                        {previewing ? '...' : 'Preview'}
                    </button>
                    <button className="btn-add-purple" onClick={onImport} disabled={!importFile || importing}>
                        {importing ? '...' : 'Import'}
                    </button>
                </div>
                {previewResult && (
                    <div className="backup-preview backup-card-preview">
                        <p>Valid: {previewResult.valid} | Import: {previewResult.toImport} | Skipped: {previewResult.skipped}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BackupCardsView;
