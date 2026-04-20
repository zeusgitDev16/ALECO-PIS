import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import AdminLayout from './AdminLayout';
import ConfirmModal from './tickets/ConfirmModal';
import ExportPreviewModal from './backup/ExportPreviewModal';
import BackupLayoutPicker from './backup/BackupLayoutPicker';
import BackupDateBar from './backup/BackupDateBar';
import BackupCompactView from './backup/BackupCompactView';
import BackupCardsView from './backup/BackupCardsView';
import BackupWorkflowView from './backup/BackupWorkflowView';
import BackupFiltersBar from './backup/BackupFiltersBar';
import BackupInterruptionFiltersBar from './backup/BackupInterruptionFiltersBar';
import BackupTicketFiltersForm, { getActiveTicketFiltersCount } from './backup/BackupTicketFiltersForm';
import BackupInterruptionFiltersForm, { getActiveInterruptionFiltersCount } from './backup/BackupInterruptionFiltersForm';
import EntityPicker from './backup/EntityPicker';
import ComingSoonPlaceholder from './backup/ComingSoonPlaceholder';
import TicketFilterDrawer from './tickets/TicketFilterDrawer';
import '../CSS/AdminPageLayout.css';
import '../CSS/BackupUIScale.css';
import '../CSS/Buttons.css';
import '../CSS/TicketFilterDrawer.css';
import '../CSS/Backup.css';

const AdminBackup = () => {
    const [entity, setEntity] = useState(() => localStorage.getItem('dataManagementEntity') || 'tickets');
    const [layoutMode, setLayoutMode] = useState('compact');
    const [preset, setPreset] = useState('thisMonth');
    const [useCustom, setUseCustom] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [format, setFormat] = useState('excel');
    const [exporting, setExporting] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [previewResult, setPreviewResult] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filters, setFilters] = useState({
        category: '',
        district: '',
        municipality: '',
        status: '',
        groupFilter: 'all',
        isNew: false,
        isUrgent: false
    });
    const [interruptionFilters, setInterruptionFilters] = useState({
        type: '',
        status: '',
        includeArchived: false
    });

    const ticketFilterActiveCount = useMemo(() => getActiveTicketFiltersCount(filters), [filters]);
    const interruptionFilterActiveCount = useMemo(
        () => getActiveInterruptionFiltersCount(interruptionFilters),
        [interruptionFilters]
    );

    const isTicketsEntity = entity === 'tickets';
    const isInterruptionsEntity = entity === 'interruptions';
    const isUsersEntity = entity === 'users';
    const isPersonnelEntity = entity === 'personnel';
    const hasDataFilters =
        isTicketsEntity || isInterruptionsEntity || isUsersEntity || isPersonnelEntity;
    const showFilterButton = isTicketsEntity || isInterruptionsEntity;

    const filterActiveCount = isTicketsEntity
        ? ticketFilterActiveCount
        : isInterruptionsEntity
            ? interruptionFilterActiveCount
            : 0;

    const getExportBasePath = () => {
        if (isInterruptionsEntity) return '/api/interruptions/export';
        if (isUsersEntity) return '/api/users/export';
        if (isPersonnelEntity) return '/api/personnel/export';
        return '/api/tickets/export';
    };

    const getExportPreviewBasePath = () => {
        if (isInterruptionsEntity) return '/api/interruptions/export/preview';
        if (isUsersEntity) return '/api/users/export/preview';
        if (isPersonnelEntity) return '/api/personnel/export/preview';
        return '/api/tickets/export/preview';
    };

    const getExportParams = () => {
        const base = useCustom && startDate && endDate
            ? { startDate, endDate, format }
            : { preset, format };

        if (isInterruptionsEntity) {
            if (interruptionFilters.type) base.type = interruptionFilters.type;
            if (interruptionFilters.status) base.status = interruptionFilters.status;
            if (interruptionFilters.includeArchived) base.includeArchived = 'true';
            return base;
        }

        if (isUsersEntity || isPersonnelEntity) {
            return base;
        }

        if (filters.category) base.category = filters.category;
        if (filters.district) base.district = filters.district;
        if (filters.municipality) base.municipality = filters.municipality;
        if (filters.status) base.status = filters.status;
        if (filters.groupFilter && filters.groupFilter !== 'all') base.groupFilter = filters.groupFilter;
        if (filters.isNew) base.isNew = 'true';
        if (filters.isUrgent) base.isUrgent = 'true';
        return base;
    };

    const getArchiveBody = () => {
        const base = useCustom && startDate && endDate
            ? { startDate, endDate }
            : { preset };
        if (filters.category) base.category = filters.category;
        if (filters.district) base.district = filters.district;
        if (filters.municipality) base.municipality = filters.municipality;
        if (filters.status) base.status = filters.status;
        if (filters.groupFilter && filters.groupFilter !== 'all') base.groupFilter = filters.groupFilter;
        if (filters.isNew) base.isNew = 'true';
        if (filters.isUrgent) base.isUrgent = 'true';
        return base;
    };

    const handleExport = async () => {
        if (useCustom && (!startDate || !endDate)) {
            toast.error('Please select start and end dates for custom range.');
            return;
        }
        if (!useCustom && !preset) {
            toast.error('Please select a date preset.');
            return;
        }
        setExporting(true);
        try {
            const params = getExportParams();
            const qs = new URLSearchParams(params).toString();
            const basePath = getExportBasePath();
            const url = apiUrl(`${basePath}?${qs}`);
            const userEmail = localStorage.getItem('userEmail');
            const userName = localStorage.getItem('userName');
            const headers = {};
            if (userEmail) headers['X-User-Email'] = userEmail;
            if (userName) headers['X-User-Name'] = userName;

            const res = await fetch(url, { headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Export failed');
            }
            const blob = await res.blob();
            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = isInterruptionsEntity
                ? `aleco_interruptions_export.${format === 'excel' ? 'xlsx' : 'csv'}`
                : `aleco_tickets_export.${format === 'excel' ? 'xlsx' : 'csv'}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
                if (match) filename = match[1];
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success('Export downloaded successfully.');
        } catch (err) {
            toast.error(err.message || 'Export failed.');
        } finally {
            setExporting(false);
        }
    };

    const handleViewInBrowser = async () => {
        if (useCustom && (!startDate || !endDate)) {
            toast.error('Please select start and end dates for custom range.');
            return;
        }
        if (!useCustom && !preset) {
            toast.error('Please select a date preset.');
            return;
        }
        setPreviewLoading(true);
        setPreviewModalOpen(false);
        setPreviewData(null);
        try {
            const params = getExportParams();
            const qs = new URLSearchParams(params).toString();
            const basePath = getExportPreviewBasePath();
            const res = await authFetch(apiUrl(`${basePath}?${qs}`));
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Preview failed');
            setPreviewData(data);
            setPreviewModalOpen(true);
        } catch (err) {
            toast.error(err.message || 'Preview failed.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleArchiveConfirm = async () => {
        if (useCustom && (!startDate || !endDate)) {
            toast.error('Please select start and end dates.');
            return;
        }
        if (!useCustom && !preset) {
            toast.error('Please select a date preset.');
            return;
        }
        setArchiving(true);
        setArchiveConfirmOpen(false);
        try {
            const body = getArchiveBody();
            const res = await authFetch(apiUrl('/api/tickets/archive'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Archive failed');
            toast.success(`${data.archivedCount} ticket(s) archived.`);
        } catch (err) {
            toast.error(err.message || 'Archive failed.');
        } finally {
            setArchiving(false);
        }
    };

    const handlePreview = async () => {
        if (!importFile) {
            toast.error('Please select a file first.');
            return;
        }
        setPreviewing(true);
        setPreviewResult(null);
        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const res = await authFetch(apiUrl('/api/tickets/import?dryRun=true'), {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Preview failed');
            setPreviewResult(data);
            toast.success('Preview complete.');
        } catch (err) {
            toast.error(err.message || 'Preview failed.');
        } finally {
            setPreviewing(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            toast.error('Please select a file first.');
            return;
        }
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const res = await authFetch(apiUrl('/api/tickets/import'), {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Import failed');
            toast.success(`Imported ${data.imported} ticket(s). Skipped: ${data.skipped}. Failed: ${data.failed || 0}.`);
            setImportFile(null);
            setPreviewResult(null);
        } catch (err) {
            toast.error(err.message || 'Import failed.');
        } finally {
            setImporting(false);
        }
    };

    const sharedProps = {
        entity,
        format,
        onFormatChange: setFormat,
        exporting,
        onExport: handleExport,
        previewLoading,
        onViewInBrowser: handleViewInBrowser,
        archiving,
        onArchiveClick: () => setArchiveConfirmOpen(true),
        importFile,
        onImportFileChange: setImportFile,
        importing,
        previewing,
        onPreview: handlePreview,
        onImport: handleImport,
        previewResult
    };

    const filterButton = showFilterButton ? (
        <button
            type="button"
            className="ticket-filter-inline-btn"
            onClick={() => setFilterDrawerOpen(true)}
            aria-label="Open filters"
            title="Filters"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {filterActiveCount > 0 && (
                <span className="ticket-filter-inline-badge">{filterActiveCount}</span>
            )}
        </button>
    ) : null;

    const dataManagementMain = (
        <>
            <div className="backup-date-bar-wrap">
                <BackupDateBar
                    preset={preset}
                    useCustom={useCustom}
                    startDate={startDate}
                    endDate={endDate}
                    onPresetChange={setPreset}
                    onUseCustomChange={setUseCustom}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                />
            </div>

            {isTicketsEntity && <BackupFiltersBar filters={filters} setFilters={setFilters} />}
            {isInterruptionsEntity && (
                <BackupInterruptionFiltersBar filters={interruptionFilters} setFilters={setInterruptionFilters} />
            )}

            <div
                className={
                    layoutMode === 'workflow'
                        ? 'backup-content backup-content--workflow'
                        : 'backup-content'
                }
            >
                {layoutMode === 'compact' && <BackupCompactView {...sharedProps} />}
                {layoutMode === 'card' && <BackupCardsView {...sharedProps} />}
                {layoutMode === 'workflow' && <BackupWorkflowView {...sharedProps} />}
            </div>
        </>
    );

    return (
        <AdminLayout activePage="backup">
            <div className="admin-page-container backup-page-container">
                <div className="backup-header">
                    <div className="header-text-group">
                        <h2 className="header-title">Data Management</h2>
                        <p className="header-subtitle">Export, import, and archive data across all features.</p>
                    </div>
                    <div className="backup-header-pickers">
                        <EntityPicker activeEntity={entity} onEntityChange={setEntity} />
                        <BackupLayoutPicker
                            activeLayout={layoutMode}
                            onLayoutChange={setLayoutMode}
                            filterButton={filterButton}
                        />
                    </div>
                </div>

                {hasDataFilters ? dataManagementMain : (
                    <ComingSoonPlaceholder entityId={entity} />
                )}

                {showFilterButton && (
                    <TicketFilterDrawer isOpen={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}>
                        <div className="backup-filter-drawer-form">
                            {isTicketsEntity && (
                                <div className="backup-filters-content backup-filters-content--drawer">
                                    <BackupTicketFiltersForm filters={filters} setFilters={setFilters} />
                                </div>
                            )}
                            {isInterruptionsEntity && (
                                <div className="backup-filters-content backup-filters-content--drawer">
                                    <BackupInterruptionFiltersForm
                                        filters={interruptionFilters}
                                        setFilters={setInterruptionFilters}
                                    />
                                </div>
                            )}
                        </div>
                    </TicketFilterDrawer>
                )}
            </div>

            <ConfirmModal
                isOpen={archiveConfirmOpen}
                onClose={() => setArchiveConfirmOpen(false)}
                onConfirm={handleArchiveConfirm}
                title="Archive Tickets"
                message="This will soft-delete all tickets in the selected date range and remove their logs. This cannot be undone. Continue?"
                confirmLabel="Archive"
                variant="danger"
            />

            <ExportPreviewModal
                isOpen={previewModalOpen}
                onClose={() => setPreviewModalOpen(false)}
                data={previewData}
                entity={entity}
            />
        </AdminLayout>
    );
};

export default AdminBackup;
