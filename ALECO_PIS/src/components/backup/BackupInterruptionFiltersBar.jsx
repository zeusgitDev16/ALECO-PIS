import React from 'react';
import BackupInterruptionFiltersForm from './BackupInterruptionFiltersForm';
import '../../CSS/Backup.css';

const BackupInterruptionFiltersBar = ({ filters, setFilters }) => (
    <div className="backup-filters-wrapper backup-filters-desktop">
        <div className="backup-filters-content">
            <BackupInterruptionFiltersForm filters={filters} setFilters={setFilters} />
        </div>
    </div>
);

export default BackupInterruptionFiltersBar;
