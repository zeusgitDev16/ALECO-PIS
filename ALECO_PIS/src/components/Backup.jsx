import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import AdminLayout from './AdminLayout';
import ExportPreviewModal from './backup/ExportPreviewModal';
import ImportPreviewModal from './backup/ImportPreviewModal';
import BackupLayoutPicker from './backup/BackupLayoutPicker';
import BackupDateBar from './backup/BackupDateBar';
import BackupCompactView from './backup/BackupCompactView';
import BackupCardsView from './backup/BackupCardsView';
import BackupWorkflowView from './backup/BackupWorkflowView';
import BackupFiltersBar from './backup/BackupFiltersBar';
import BackupInterruptionFiltersBar from './backup/BackupInterruptionFiltersBar';
import BackupHistoryFiltersBar from './backup/BackupHistoryFiltersBar';
import BackupTicketFiltersForm, { getActiveTicketFiltersCount } from './backup/BackupTicketFiltersForm';
import BackupInterruptionFiltersForm, { getActiveInterruptionFiltersCount } from './backup/BackupInterruptionFiltersForm';
import BackupHistoryFiltersForm, { getActiveHistoryFiltersCount } from './backup/BackupHistoryFiltersForm';
import EntityPicker from './backup/EntityPicker';
import ComingSoonPlaceholder from './backup/ComingSoonPlaceholder';
import TicketFilterDrawer from './tickets/TicketFilterDrawer';
import { USER_ROLES } from '../constants/userRoles';
import { DATA_MANAGEMENT_ENTITIES } from '../constants/dataManagementEntities';
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
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
    const [exportFileName, setExportFileName] = useState('');
    const [archiving, setArchiving] = useState(false);
    const [archiveVerifyOpen, setArchiveVerifyOpen] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState(() => localStorage.getItem('userEmail') || '');
    const [deleteCode, setDeleteCode] = useState('');
    const [requestingDeleteCode, setRequestingDeleteCode] = useState(false);
    const [verifyingDeleteCode, setVerifyingDeleteCode] = useState(false);
    const [deleteAuthToken, setDeleteAuthToken] = useState('');
    const [deleteCooldownSeconds, setDeleteCooldownSeconds] = useState(0);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [previewResult, setPreviewResult] = useState(null);
    const [importPreviewOpen, setImportPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('Export Preview');
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
        isUrgent: false,
        hasMemo: false
    });
    const [interruptionFilters, setInterruptionFilters] = useState({
        type: '',
        status: '',
        includeArchived: false
    });
    const [historyFilters, setHistoryFilters] = useState({
        modules: ['tickets', 'interruptions', 'personnel', 'users', 'data_management', 'b2b'],
        q: '',
        actor: ''
    });

    const ticketFilterActiveCount = useMemo(() => getActiveTicketFiltersCount(filters), [filters]);
    const interruptionFilterActiveCount = useMemo(
        () => getActiveInterruptionFiltersCount(interruptionFilters),
        [interruptionFilters]
    );
    const historyFilterActiveCount = useMemo(
        () => getActiveHistoryFiltersCount(historyFilters),
        [historyFilters]
    );

    const isTicketsEntity = entity === 'tickets';
    const isInterruptionsEntity = entity === 'interruptions';
    const isUsersEntity = entity === 'users';
    const isHistoryEntity = entity === 'history';
    const isPersonnelEntity = entity === 'personnel';
    const currentRole = String(localStorage.getItem('userRole') || USER_ROLES.EMPLOYEE).toLowerCase();
    const canDeleteTickets = currentRole === USER_ROLES.ADMIN;
    const canViewHistory = currentRole === USER_ROLES.ADMIN;
    const entityOptions = useMemo(
        () => DATA_MANAGEMENT_ENTITIES.filter((item) => canViewHistory || item.id !== 'history'),
        [canViewHistory]
    );
    const hasDataFilters =
        isTicketsEntity || isInterruptionsEntity || isUsersEntity || isPersonnelEntity || isHistoryEntity;
    const showFilterButton = isTicketsEntity || isInterruptionsEntity || isHistoryEntity;

    useEffect(() => {
        if (!canViewHistory && entity === 'history') {
            setEntity('tickets');
            localStorage.setItem('dataManagementEntity', 'tickets');
        }
    }, [canViewHistory, entity]);

    const filterActiveCount = isTicketsEntity
        ? ticketFilterActiveCount
        : isInterruptionsEntity
            ? interruptionFilterActiveCount
            : isHistoryEntity
                ? historyFilterActiveCount
            : 0;

    const getExportBasePath = () => {
        if (isInterruptionsEntity) return '/api/interruptions/export';
        if (isUsersEntity) return '/api/users/export';
        if (isHistoryEntity) return '/api/history/export';
        if (isPersonnelEntity) return '/api/personnel/export';
        return '/api/tickets/export';
    };

    const getExportPreviewBasePath = () => {
        if (isInterruptionsEntity) return '/api/interruptions/export/preview';
        if (isUsersEntity) return '/api/users/export/preview';
        if (isHistoryEntity) return '/api/history/export/preview';
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

        if (isHistoryEntity) {
            if (Array.isArray(historyFilters.modules) && historyFilters.modules.length > 0) {
                base.modules = historyFilters.modules.join(',');
            }
            if (historyFilters.q) base.q = historyFilters.q;
            if (historyFilters.actor) base.actor = historyFilters.actor;
            return base;
        }

        if (filters.category) base.category = filters.category;
        if (filters.district) base.district = filters.district;
        if (filters.municipality) base.municipality = filters.municipality;
        if (filters.status) base.status = filters.status;
        if (filters.groupFilter && filters.groupFilter !== 'all') base.groupFilter = filters.groupFilter;
        if (filters.isNew) base.isNew = 'true';
        if (filters.isUrgent) base.isUrgent = 'true';
        if (filters.hasMemo) base.hasMemo = 'true';
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
        if (filters.hasMemo) base.hasMemo = 'true';
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
                : isUsersEntity
                    ? `aleco_users_export.${format === 'excel' ? 'xlsx' : 'csv'}`
                    : isHistoryEntity
                        ? `aleco_history_export.${format === 'excel' ? 'xlsx' : 'csv'}`
                    : isPersonnelEntity
                        ? `aleco_personnel_export.${format === 'excel' ? 'xlsx' : 'csv'}`
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

    const openExportConfirm = () => {
        const suggestedBase = isInterruptionsEntity
            ? 'aleco_interruptions_export'
            : isUsersEntity
                ? 'aleco_users_export'
                : isHistoryEntity
                    ? 'aleco_history_export'
                : isPersonnelEntity
                    ? 'aleco_personnel_export'
                    : 'aleco_tickets_export';
        setExportFileName(suggestedBase);
        setExportConfirmOpen(true);
    };

    const handleExportConfirm = async () => {
        const baseName = String(exportFileName || '').trim();
        if (!baseName) {
            toast.error('Please provide a file name.');
            return;
        }
        setExportConfirmOpen(false);
        await handleExportWithCustomName(baseName);
    };

    const handleExportWithCustomName = async (baseName) => {
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
            const ext = format === 'excel' ? 'xlsx' : 'csv';
            const normalized = baseName.endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`;

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = normalized;
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
        setPreviewTitle('Export Preview');
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

    const handleDeletePreview = async () => {
        if (useCustom && (!startDate || !endDate)) {
            toast.error('Please select start and end dates.');
            return;
        }
        if (!useCustom && !preset) {
            toast.error('Please select a date preset.');
            return;
        }
        setPreviewLoading(true);
        setPreviewModalOpen(false);
        setPreviewData(null);
        setPreviewTitle('Delete Preview');
        try {
            const body = getArchiveBody();
            const res = await authFetch(apiUrl('/api/tickets/archive/preview'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Delete preview failed');
            setPreviewData(data);
            setPreviewModalOpen(true);
        } catch (err) {
            toast.error(err.message || 'Delete preview failed.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleArchiveConfirm = async () => {
        if (!canDeleteTickets) {
            toast.error('Only admins can bulk delete tickets.');
            return;
        }
        if (!deleteAuthToken) {
            toast.error('Delete verification required.');
            return;
        }
        if (useCustom && (!startDate || !endDate)) {
            toast.error('Please select start and end dates.');
            return;
        }
        if (!useCustom && !preset) {
            toast.error('Please select a date preset.');
            return;
        }
        setArchiving(true);
        try {
            const body = { ...getArchiveBody(), deleteAuthToken };
            const res = await authFetch(apiUrl('/api/tickets/archive'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Archive failed');
            const deletedCount = Number(data.deletedCount || 0);
            const blockedCount = Number(data.blockedGroupedCount || 0);
            if (blockedCount > 0) {
                toast.warn(
                    `Permanently deleted ${deletedCount} ticket(s). ${blockedCount} grouped ticket(s) were blocked. Ungroup first.`
                );
            } else {
                toast.success(`Permanently deleted ${deletedCount} ticket(s).`);
            }
            setArchiveVerifyOpen(false);
            setDeleteCode('');
            setDeleteAuthToken('');
        } catch (err) {
            toast.error(err.message || 'Archive failed.');
        } finally {
            setArchiving(false);
        }
    };

    useEffect(() => {
        if (!archiveVerifyOpen || deleteCooldownSeconds <= 0) return undefined;
        const timer = window.setInterval(() => {
            setDeleteCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [archiveVerifyOpen, deleteCooldownSeconds]);

    const openDeleteVerification = () => {
        if (!canDeleteTickets) return;
        setArchiveVerifyOpen(true);
        setDeleteEmail(localStorage.getItem('userEmail') || '');
        setDeleteCode('');
        setDeleteAuthToken('');
    };

    const closeDeleteVerification = () => {
        setArchiveVerifyOpen(false);
        setDeleteCode('');
        setDeleteAuthToken('');
        setRequestingDeleteCode(false);
        setVerifyingDeleteCode(false);
    };

    const handleRequestDeleteCode = async () => {
        const loggedInEmail = String(localStorage.getItem('userEmail') || '').trim().toLowerCase();
        const entered = String(deleteEmail || '').trim().toLowerCase();
        if (!entered) {
            toast.error('Enter your admin email first.');
            return;
        }
        if (entered !== loggedInEmail) {
            toast.error('Email must match your logged-in admin account.');
            return;
        }
        setRequestingDeleteCode(true);
        try {
            const res = await authFetch(apiUrl('/api/tickets/archive/request-delete-code'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: entered }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send code.');
            setDeleteCooldownSeconds(Number(data.cooldownSeconds || 60));
            toast.success('Verification code sent to your email.');
        } catch (err) {
            toast.error(err.message || 'Failed to send code.');
        } finally {
            setRequestingDeleteCode(false);
        }
    };

    const handleVerifyDeleteCode = async () => {
        const entered = String(deleteEmail || '').trim().toLowerCase();
        const code = String(deleteCode || '').trim();
        if (!entered || !code) {
            toast.error('Email and code are required.');
            return;
        }
        setVerifyingDeleteCode(true);
        try {
            const res = await authFetch(apiUrl('/api/tickets/archive/verify-delete-code'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: entered, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to verify code.');
            setDeleteAuthToken(data.deleteAuthToken || '');
            toast.success('Delete verification confirmed. You can now delete.');
        } catch (err) {
            toast.error(err.message || 'Failed to verify code.');
        } finally {
            setVerifyingDeleteCode(false);
        }
    };

    const handlePreview = async () => {
        if (!importFile) {
            toast.error('Please select a file first.');
            return;
        }
        setPreviewing(true);
        setPreviewResult(null);
        setImportPreviewOpen(false);
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
            setImportPreviewOpen(true);
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
            if (!res.ok) {
                if (res.status === 409) {
                    toast.info(
                        data.message ||
                        `No missing tickets to restore. Existing in DB: ${Number(data.skipped || 0)}.`
                    );
                    return;
                }
                throw new Error(data.message || 'Import failed');
            }
            toast.success(`Imported ${data.imported} ticket(s). Skipped: ${data.skipped}. Failed: ${data.failed || 0}.`);
            setImportFile(null);
            setPreviewResult(null);
            setImportPreviewOpen(false);
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
        onExport: openExportConfirm,
        previewLoading,
        onViewInBrowser: handleViewInBrowser,
        archiving,
        canDeleteTickets,
        onArchiveClick: openDeleteVerification,
        onArchivePreview: handleDeletePreview,
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
            {isHistoryEntity && (
                <BackupHistoryFiltersBar filters={historyFilters} setFilters={setHistoryFilters} />
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
                        <EntityPicker activeEntity={entity} onEntityChange={setEntity} entities={entityOptions} />
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
                            {isHistoryEntity && (
                                <div className="backup-filters-content backup-filters-content--drawer">
                                    <BackupHistoryFiltersForm
                                        filters={historyFilters}
                                        setFilters={setHistoryFilters}
                                    />
                                </div>
                            )}
                        </div>
                    </TicketFilterDrawer>
                )}
            </div>

            {archiveVerifyOpen && (
                <div className="dispatch-modal-overlay confirm-modal-overlay" onClick={closeDeleteVerification}>
                    <div className="dispatch-modal-content confirm-modal-content backup-delete-verify-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="dispatch-modal-close-btn" onClick={closeDeleteVerification} aria-label="Close">&times;</button>

                        <div className="dispatch-modal-header-container">
                            <h2 className="dispatch-modal-header">Admin Delete Verification</h2>
                            <p className="dispatch-modal-subtitle">
                                Enter your logged-in admin email, request the code, verify it, then confirm permanent deletion.
                            </p>
                        </div>

                        <div className="backup-delete-verify-fields">
                            <label className="backup-delete-verify-label" htmlFor="delete-verify-email">Admin Email</label>
                            <input
                                id="delete-verify-email"
                                type="email"
                                className="backup-delete-verify-input"
                                value={deleteEmail}
                                onChange={(e) => setDeleteEmail(e.target.value)}
                                placeholder="name@gmail.com"
                                autoComplete="email"
                            />

                            <label className="backup-delete-verify-label" htmlFor="delete-verify-code">Delete Code</label>
                            <input
                                id="delete-verify-code"
                                type="text"
                                className="backup-delete-verify-input"
                                value={deleteCode}
                                onChange={(e) => setDeleteCode(e.target.value)}
                                placeholder="6-digit code"
                                inputMode="numeric"
                                maxLength={6}
                            />
                            <button
                                type="button"
                                className="btn-action btn-ongoing backup-delete-verify-send-btn"
                                onClick={handleRequestDeleteCode}
                                disabled={requestingDeleteCode || deleteCooldownSeconds > 0}
                            >
                                {requestingDeleteCode
                                    ? 'Sending...'
                                    : deleteCooldownSeconds > 0
                                        ? `Resend in ${deleteCooldownSeconds}s`
                                        : 'Send Code'}
                            </button>
                        </div>

                        <div className="dispatch-modal-actions">
                            <button type="button" className="btn-action btn-cancel" onClick={closeDeleteVerification}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-action btn-ongoing"
                                onClick={handleVerifyDeleteCode}
                                disabled={verifyingDeleteCode || !deleteEmail || !deleteCode}
                            >
                                {verifyingDeleteCode ? 'Verifying...' : 'Verify Code'}
                            </button>
                            <button
                                type="button"
                                className="btn-action btn-delete"
                                onClick={handleArchiveConfirm}
                                disabled={archiving || !deleteAuthToken}
                            >
                                {archiving ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ExportPreviewModal
                isOpen={previewModalOpen}
                onClose={() => setPreviewModalOpen(false)}
                data={previewData}
                entity={entity}
                title={previewTitle}
            />

            <ImportPreviewModal
                isOpen={importPreviewOpen}
                onClose={() => setImportPreviewOpen(false)}
                preview={previewResult}
            />

            {exportConfirmOpen && (
                <div className="dispatch-modal-overlay confirm-modal-overlay" onClick={() => setExportConfirmOpen(false)}>
                    <div className="dispatch-modal-content confirm-modal-content backup-export-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="dispatch-modal-close-btn" onClick={() => setExportConfirmOpen(false)} aria-label="Close">&times;</button>

                        <div className="dispatch-modal-header-container">
                            <h2 className="dispatch-modal-header">Confirm Export Download</h2>
                            <p className="dispatch-modal-subtitle">
                                Enter your preferred file name before downloading.
                            </p>
                        </div>

                        <div className="backup-delete-verify-fields">
                            <label className="backup-delete-verify-label" htmlFor="export-file-name">File Name</label>
                            <input
                                id="export-file-name"
                                type="text"
                                className="backup-delete-verify-input"
                                value={exportFileName}
                                onChange={(e) => setExportFileName(e.target.value)}
                                placeholder="e.g. tickets_apr_2026"
                                autoFocus
                            />
                        </div>

                        <div className="dispatch-modal-actions">
                            <button type="button" className="btn-action btn-cancel" onClick={() => setExportConfirmOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-add-purple" onClick={handleExportConfirm} disabled={exporting}>
                                {exporting ? 'Downloading...' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminBackup;
