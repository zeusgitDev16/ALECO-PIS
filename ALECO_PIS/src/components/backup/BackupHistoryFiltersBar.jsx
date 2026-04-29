import React from 'react';
import BackupHistoryFiltersForm from './BackupHistoryFiltersForm';
import '../../CSS/Backup.css';

const BackupHistoryFiltersBar = ({ filters, setFilters }) => (
    <div className="backup-filters-wrapper backup-filters-desktop">
        <div className="backup-filters-content">
            <BackupHistoryFiltersForm filters={filters} setFilters={setFilters} />
        </div>
    </div>
);

export default BackupHistoryFiltersBar;
