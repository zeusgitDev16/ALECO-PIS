import React from 'react';
import BackupB2BMailFiltersForm from './BackupB2BMailFiltersForm';
import '../../CSS/Backup.css';

const BackupB2BMailFiltersBar = ({ filters, setFilters }) => (
    <div className="backup-filters-wrapper backup-filters-desktop">
        <div className="backup-filters-content">
            <BackupB2BMailFiltersForm filters={filters} setFilters={setFilters} />
        </div>
    </div>
);

export default BackupB2BMailFiltersBar;
