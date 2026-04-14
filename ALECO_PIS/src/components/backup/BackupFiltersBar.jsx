import React from 'react';
import BackupTicketFiltersForm from './BackupTicketFiltersForm';
import '../../CSS/Backup.css';

const BackupFiltersBar = ({ filters, setFilters }) => (
    <div className="backup-filters-wrapper backup-filters-desktop">
        <div className="backup-filters-content">
            <BackupTicketFiltersForm filters={filters} setFilters={setFilters} />
        </div>
    </div>
);

export default BackupFiltersBar;
