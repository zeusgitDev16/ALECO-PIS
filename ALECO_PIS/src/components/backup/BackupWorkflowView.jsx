import React from 'react';
import BackupFileInput from './BackupFileInput';

const BackupWorkflowView = ({
    entity = 'tickets',
    format, onFormatChange,
    exporting, onExport, previewLoading, onViewInBrowser,
    archiving, onArchiveClick,
    importFile, onImportFileChange, importing, previewing, onPreview, onImport, previewResult
}) => {
    const ticketsOnly = entity === 'tickets';
    return (
        <div className="backup-workflow">
            <div className="backup-workflow-step">
                <span className="backup-workflow-badge">1</span>
                <span className="backup-workflow-label">Date range selected above</span>
            </div>

            <div className="backup-workflow-step">
                <span className="backup-workflow-badge">2</span>
                <div className="backup-workflow-content">
                    <h4 className="backup-workflow-title">{ticketsOnly ? 'Export or Archive' : 'Export'}</h4>
                    <div className="backup-workflow-row">
                        <div className="backup-workflow-block">
                            <div className="backup-workflow-block-main">
                                <span className="backup-workflow-sub">Export</span>
                                <label><input type="radio" name="format" checked={format === 'excel'} onChange={() => onFormatChange('excel')} /> Excel</label>
                                <label><input type="radio" name="format" checked={format === 'csv'} onChange={() => onFormatChange('csv')} /> CSV</label>
                            </div>
                            <div className="backup-workflow-block-footer">
                                <div className="backup-workflow-actions backup-workflow-actions--stack">
                                    <button type="button" className="btn-add-purple backup-workflow-btn-full" onClick={onExport} disabled={exporting}>{exporting ? '...' : 'Download'}</button>
                                    <button type="button" className="btn-action btn-ongoing backup-workflow-btn-full" onClick={onViewInBrowser} disabled={previewLoading}>{previewLoading ? '...' : 'View'}</button>
                                </div>
                            </div>
                        </div>
                        {ticketsOnly && (
                            <div className="backup-workflow-block">
                                <div className="backup-workflow-block-main">
                                    <span className="backup-workflow-sub">Archive</span>
                                </div>
                                <div className="backup-workflow-block-footer">
                                    <button type="button" className="btn-action btn-delete backup-workflow-btn-full" onClick={onArchiveClick} disabled={archiving}>
                                        {archiving ? '...' : 'Archive'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {ticketsOnly && (
                <div className="backup-workflow-step backup-workflow-step--import">
                    <span className="backup-workflow-badge">3</span>
                    <div className="backup-workflow-content">
                        <h4 className="backup-workflow-title">Import</h4>
                        <BackupFileInput
                            variant="workflow"
                            importFile={importFile}
                            onImportFileChange={onImportFileChange}
                        />
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
            )}
        </div>
    );
};

export default BackupWorkflowView;
