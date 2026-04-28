import React from 'react';
import { getDataManagementExportDescription } from '../../constants/dataManagementEntities';
import BackupFileInput from './BackupFileInput';

const BackupCardsView = ({
    entity = 'tickets',
    canDeleteTickets = false,
    format, onFormatChange,
    exporting, onExport, previewLoading, onViewInBrowser,
    archiving, onArchiveClick, onArchivePreview,
    importFile, onImportFileChange, importing, previewing, onPreview, onImport, previewResult
}) => {
    const ticketsOnly = entity === 'tickets';
    return (
        <div className="backup-cards-grid">
            <div className="backup-card backup-card--export">
                <div className="backup-card-stack">
                    <div className="backup-card-icon-wrap" aria-hidden="true">
                        <div className="backup-card-icon">↓</div>
                    </div>
                    <h4 className="backup-card-title">Export</h4>
                    <p className="backup-card-desc">
                        {getDataManagementExportDescription(entity)}
                    </p>
                    <div className="backup-card-row">
                        <label><input type="radio" name="format" checked={format === 'excel'} onChange={() => onFormatChange('excel')} /> Excel</label>
                        <label><input type="radio" name="format" checked={format === 'csv'} onChange={() => onFormatChange('csv')} /> CSV</label>
                    </div>
                </div>
                <div className="backup-card-footer">
                    <div className="backup-card-actions backup-card-actions--stack">
                        <button type="button" className="btn-add-purple backup-card-btn-full" onClick={onExport} disabled={exporting}>
                            {exporting ? '...' : 'Download'}
                        </button>
                        <button type="button" className="btn-action btn-ongoing backup-card-btn-full" onClick={onViewInBrowser} disabled={previewLoading}>
                            {previewLoading ? '...' : 'View in browser'}
                        </button>
                    </div>
                </div>
            </div>

            {ticketsOnly && (
                <>
                    {canDeleteTickets && (
                        <div className="backup-card backup-card--archive">
                            <div className="backup-card-stack">
                                <div className="backup-card-icon-wrap" aria-hidden="true">
                                    <div className="backup-card-icon">⊟</div>
                                </div>
                                <h4 className="backup-card-title">Delete</h4>
                                <p className="backup-card-desc">Permanently delete ungrouped tickets in date range.</p>
                            </div>
                            <div className="backup-card-footer">
                                <button type="button" className="btn-action btn-ongoing backup-card-btn-full" onClick={onArchivePreview} disabled={previewLoading}>
                                    {previewLoading ? 'Loading...' : 'Preview delete'}
                                </button>
                                <button type="button" className="btn-action btn-delete backup-card-btn-full" onClick={onArchiveClick} disabled={archiving}>
                                    {archiving ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="backup-card backup-card--import">
                        <div className="backup-card-stack">
                            <div className="backup-card-icon-wrap" aria-hidden="true">
                                <div className="backup-card-icon">↑</div>
                            </div>
                            <h4 className="backup-card-title">Import</h4>
                            <p className="backup-card-desc">Upload .xlsx or .csv file.</p>
                        </div>
                        <div className="backup-card-footer">
                            <BackupFileInput
                                variant="card"
                                importFile={importFile}
                                onImportFileChange={onImportFileChange}
                            />
                            <div className="backup-card-actions backup-card-actions--import">
                                <button type="button" className="btn-action btn-cancel backup-card-btn-half" onClick={onPreview} disabled={!importFile || previewing}>
                                    {previewing ? '...' : 'Preview'}
                                </button>
                                <button type="button" className="btn-add-purple backup-card-btn-half" onClick={onImport} disabled={!importFile || importing}>
                                    {importing ? '...' : 'Import'}
                                </button>
                            </div>
                        </div>
                        {previewResult && (
                            <div className="backup-preview backup-card-preview">
                                <p>Valid: {previewResult.valid} | Import: {previewResult.toImport} | Skipped: {previewResult.skipped}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default BackupCardsView;
