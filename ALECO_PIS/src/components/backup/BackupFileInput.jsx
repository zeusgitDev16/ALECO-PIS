import React, { useId } from 'react';

/**
 * Styled file control (hidden native input + label + filename) for Data Management import flows.
 * @param {'card'|'compact'|'workflow'} variant
 */
const BackupFileInput = ({ importFile, onImportFileChange, variant = 'card' }) => {
    const id = useId();

    return (
        <div className={`backup-file-input backup-file-input--${variant}`}>
            <input
                id={id}
                type="file"
                accept=".xlsx,.csv"
                className="backup-file-input-native"
                aria-label="Choose spreadsheet file (.xlsx or .csv)"
                onChange={(e) => onImportFileChange(e.target.files?.[0] || null)}
            />
            <div className="backup-file-input-row">
                <label htmlFor={id} className="backup-file-input-trigger">
                    <span className="backup-file-input-trigger-icon" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </span>
                    Choose file
                </label>
                <span className="backup-file-input-filename" title={importFile?.name || ''}>
                    {importFile?.name || 'No file chosen'}
                </span>
            </div>
        </div>
    );
};

export default BackupFileInput;
