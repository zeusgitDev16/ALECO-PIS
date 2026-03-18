import React from 'react';

const PRESETS = [
    { value: 'today', label: 'Today' },
    { value: 'last7', label: 'Last 7 days' },
    { value: 'thisWeek', label: 'This week' },
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'thisYear', label: 'This year' }
];

const BackupDateBar = ({ preset, useCustom, startDate, endDate, onPresetChange, onUseCustomChange, onStartDateChange, onEndDateChange }) => {
    return (
        <div className="backup-date-bar">
            <label className="backup-date-bar-toggle">
                <input type="checkbox" checked={useCustom} onChange={(e) => onUseCustomChange(e.target.checked)} />
                <span>Custom range</span>
            </label>
            {useCustom ? (
                <div className="backup-date-bar-inputs">
                    <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} aria-label="Start date" />
                    <span className="backup-date-bar-sep">to</span>
                    <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} aria-label="End date" />
                </div>
            ) : (
                <select value={preset} onChange={(e) => onPresetChange(e.target.value)} aria-label="Date preset" className="backup-date-bar-select">
                    {PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            )}
        </div>
    );
};

export default BackupDateBar;
export { PRESETS };
