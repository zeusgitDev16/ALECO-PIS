import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { generateInterruptionPosterStub, captureInterruptionPoster } from '../api/interruptionsApi';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/Buttons.css';
import '../CSS/InterruptionsAdmin.css';
import '../CSS/InterruptionUIScale.css';
import { FILTER_CHIPS, isInterruptionEnergizedStatus } from '../utils/interruptionLabels';
import { emptyForm, buildInterruptionPayload, rowToFormState, validateInterruptionForm } from '../utils/interruptionFormUtils';
import { useAdminInterruptions } from '../hooks/useAdminInterruptions';
import InterruptionAdvisoryFilters from './interruptions/InterruptionAdvisoryFilters';
import InterruptionAdvisoryForm from './interruptions/InterruptionAdvisoryForm';
import InterruptionAdvisoryViewOnly from './interruptions/InterruptionAdvisoryViewOnly';
import InterruptionAdvisoryBoard from './interruptions/InterruptionAdvisoryBoard';
import InterruptionCompactView from './interruptions/InterruptionCompactView';
import InterruptionWorkflowView from './interruptions/InterruptionWorkflowView';
import InterruptionLayoutPicker from './interruptions/InterruptionLayoutPicker';
import UpdateAdvisoryModal from './interruptions/UpdateAdvisoryModal';
import InterruptionFilterDrawer from './interruptions/InterruptionFilterDrawer';
import { useRecentOpenedAdvisories } from '../utils/useRecentOpenedAdvisories';
import RecentOpenedAdvisories from './containers/RecentOpenedAdvisories';
import '../CSS/InterruptionLayoutPicker.css';
import '../CSS/InterruptionWorkflowView.css';
import '../CSS/InterruptionFilterDrawer.css';
import '../CSS/InterruptionModalUIScale.css';

const AdminInterruptions = () => {
  const posterRelevantFormDigest = (f) => {
    if (f?.type === 'CustomPoster') return 'custom-poster-no-capture';
    return JSON.stringify({
      type: f?.type ?? '',
      affectedAreasText: f?.affectedAreasText ?? '',
      affectedAreasGrouped: Array.isArray(f?.affectedAreasGrouped) ? f.affectedAreasGrouped : [],
      feeder: f?.feeder ?? '',
      feederId: f?.feederId ?? null,
      cause: f?.cause ?? '',
      causeCategory: f?.causeCategory ?? '',
      controlNo: f?.controlNo ?? '',
      dateTimeStart: f?.dateTimeStart ?? '',
      dateTimeEndEstimated: f?.dateTimeEndEstimated ?? '',
      dateTimeRestored: f?.dateTimeRestored ?? '',
    });
  };
  const {
    interruptions,
    loading,
    saving,
    message,
    setMessage,
    fetchError,
    fetchList,
    listArchiveFilter,
    setListArchiveFilter,
    saveAdvisory,
    removeAdvisory,
    restoreAdvisory,
    permanentDeleteAdvisory,
    pullFromFeedAdvisory,
    pushToFeedAdvisory,
    editDetail,
    detailLoading,
    memoSaving,
    memoMessage,
    loadEditDetail,
    clearEditDetail,
    addMemo,
  } = useAdminInterruptions();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(null);
  const formLoadedForIdRef = useRef(null);
  /** @type {{ id: number, feeder: string } | null} */
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  /** @type {{ id: number, feeder: string } | null} */
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState(null);
  const [activeChipKey, setActiveChipKey] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('interruptionViewMode') || 'card');
  const [updateModalId, setUpdateModalId] = useState(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [posterAssetBusy, setPosterAssetBusy] = useState(false);
  const [posterUpdateRequired, setPosterUpdateRequired] = useState(false);
  const { addOpened, recentIds, timeRange, setTimeRange, isCollapsed, setIsCollapsed } = useRecentOpenedAdvisories();

  const handleRestoreFromDetailModal = useCallback(
    async (id) => {
      const ok = await restoreAdvisory(id);
      return ok;
    },
    [restoreAdvisory]
  );

  const applyPosterUrlFromResponse = useCallback(
    async (r, fallbackErr) => {
      if (r.success && r.data) {
        const url = r.data.posterImageUrl ? String(r.data.posterImageUrl) : '';
        setForm((f) => ({ ...f, posterImageUrl: url }));
        setBaselineForm((b) => (b ? { ...b, posterImageUrl: url } : b));
        setMessage({ type: 'ok', text: r.message || 'Poster URL updated.' });
        setPosterUpdateRequired(false);
        await loadEditDetail(editingId);
        return true;
      } else if (r.success) {
        setMessage({ type: 'ok', text: r.message || 'Poster URL updated.' });
        setPosterUpdateRequired(false);
        await loadEditDetail(editingId);
        return true;
      } else {
        setMessage({ type: 'err', text: r.message || fallbackErr });
        return false;
      }
    },
    [editingId, loadEditDetail]
  );

  const handlePosterStub = useCallback(async () => {
    if (!editingId) return;
    setPosterAssetBusy(true);
    setMessage(null);
    try {
      const r = await generateInterruptionPosterStub(editingId);
      await applyPosterUrlFromResponse(r, 'Could not set poster stub.');
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setPosterAssetBusy(false);
    }
  }, [editingId, applyPosterUrlFromResponse]);

  const handlePosterCapture = useCallback(async () => {
    if (!editingId) return;
    setPosterAssetBusy(true);
    setMessage(null);
    try {
      const r = await captureInterruptionPoster(editingId);
      await applyPosterUrlFromResponse(r, 'Poster capture failed.');
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setPosterAssetBusy(false);
    }
  }, [editingId, applyPosterUrlFromResponse]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interruptionViewMode', viewMode);
    }
  }, [viewMode]);

  // Load detail for the Edit modal only. Do not clear editDetail while the Update-advisory modal is open
  // (update flow also uses editDetail + loadEditDetail); clearing here used to race and wipe data mid-load.
  useEffect(() => {
    if (modalOpen && editingId) {
      loadEditDetail(editingId);
    } else if (!updateModalId) {
      clearEditDetail();
    }
  }, [modalOpen, editingId, updateModalId, loadEditDetail, clearEditDetail]);

  useEffect(() => {
    if (!modalOpen || !editingId) {
      setBaselineForm(null);
      formLoadedForIdRef.current = null;
      return;
    }
    if (editDetail && editDetail.id === editingId) {
      const next = rowToFormState(editDetail);
      if (formLoadedForIdRef.current !== editingId) {
        formLoadedForIdRef.current = editingId;
        setForm(next);
        setBaselineForm(next);
      }
    }
  }, [modalOpen, editingId, editDetail]);

  const isDirty = useMemo(() => {
    if (!modalOpen || saving) return false;
    if (!editingId) {
      return JSON.stringify(form) !== JSON.stringify(emptyForm);
    }
    if (!baselineForm) return false;
    return JSON.stringify(form) !== JSON.stringify(baselineForm);
  }, [modalOpen, saving, editingId, form, baselineForm]);

  const doCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setBaselineForm(null);
    setMessage(null);
    setValidationErrors([]);
    setDiscardConfirmOpen(false);
    setPosterUpdateRequired(false);
    formLoadedForIdRef.current = null;
  }, []);

  const requestCloseModal = useCallback(() => {
    if (saving) return;
    if (posterUpdateRequired) {
      setMessage({ type: 'err', text: 'Update poster is required before closing this advisory.' });
      return;
    }
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    doCloseModal();
  }, [saving, isDirty, doCloseModal, posterUpdateRequired, setMessage]);

  const getActiveFiltersCount = useCallback(() => {
    let count = 0;
    if (activeChipKey !== 'all') count += 1;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [activeChipKey, searchQuery]);

  const filteredInterruptions = useMemo(() => {
    let list = interruptions;
    const chip = FILTER_CHIPS.find((c) => c.key === activeChipKey);
    if (chip?.apiStatus) {
      if (chip.apiStatus === 'Energized') {
        list = list.filter((i) => isInterruptionEnergizedStatus(i.status));
      } else {
        list = list.filter((i) => i.status === chip.apiStatus);
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const areas = (i.affectedAreas || []).join(' ');
        const hay = `${i.feeder || ''} ${i.cause || ''} ${areas}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [interruptions, activeChipKey, searchQuery]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setBaselineForm({ ...emptyForm });
    setMessage(null);
    setPosterUpdateRequired(false);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    if (row?.id != null) addOpened(row.id);
    setEditingId(row.id);
    setForm(emptyForm);
    setBaselineForm(null);
    setMessage(null);
    setValidationErrors([]);
    setPosterUpdateRequired(false);
    setModalOpen(true);
  };

  const openUpdate = (row) => {
    if (row?.id != null) addOpened(row.id);
    setMessage(null);
    setUpdateModalId(row.id);
    loadEditDetail(row.id);
  };

  const closeUpdateModal = () => {
    setUpdateModalId(null);
    clearEditDetail();
  };

  const handleSaveStatus = useCallback(
    async (payload) => {
      if (!updateModalId) return { saved: false };
      const result = await saveAdvisory({ editingId: updateModalId, payload });
      if (result.saved) {
        await loadEditDetail(updateModalId);
      }
      return result;
    },
    [updateModalId, saveAdvisory, loadEditDetail]
  );

  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    if (validationErrors.length === 0) return;
    const id = setTimeout(() => setValidationErrors([]), 8000);
    return () => clearTimeout(id);
  }, [validationErrors]);

  useEffect(() => {
    if (listArchiveFilter === 'archived') setActiveChipKey('all');
  }, [listArchiveFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateInterruptionForm(form, { editingId });
    if (errors.length > 0) {
      setValidationErrors(errors);
      setMessage({ type: 'err', text: errors.join(' ') });
      return;
    }
    setValidationErrors([]);
    const payload = buildInterruptionPayload(form, {
      editingId,
      baselineUpdatedAt: editingId ? editDetail?.updatedAt : null,
    });
    const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
    const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
    if (userEmail) payload.actorEmail = userEmail;
    if (userName) payload.actorName = userName;
    const r = await saveAdvisory({ editingId, payload });
    if (r.saved) {
      if (editingId) {
        const changed = posterRelevantFormDigest(form) !== posterRelevantFormDigest(baselineForm);
        if (changed) {
          setBaselineForm(form);
          setPosterUpdateRequired(true);
          setMessage({ type: 'ok', text: 'Changes saved. Please click Update poster before closing.' });
          return;
        }
      }
      doCloseModal();
    }
  };

  const confirmDiscardAndClose = useCallback(() => {
    setDiscardConfirmOpen(false);
    doCloseModal();
  }, [doCloseModal]);

  const handleReloadAdvisory = async () => {
    if (!editingId) return;
    setMessage(null);
    await loadEditDetail(editingId);
  };

  const handleArchiveRequest = (id) => {
    const row = interruptions.find((i) => i.id === id);
    setArchiveConfirm({ id, feeder: String(row?.feeder || '').trim() || `Advisory #${id}` });
  };

  const confirmArchive = async () => {
    if (!archiveConfirm) return;
    await removeAdvisory(archiveConfirm.id);
    setArchiveConfirm(null);
  };

  const confirmPermanentDelete = async () => {
    if (!permanentDeleteConfirm) return;
    await permanentDeleteAdvisory(permanentDeleteConfirm.id);
    setPermanentDeleteConfirm(null);
  };

  const rowFromList = editingId ? interruptions.find((i) => i.id === editingId) : null;
  const advisoryArchived = Boolean(
    editingId && (editDetail?.deletedAt ?? rowFromList?.deletedAt)
  );

  return (
    <AdminLayout activePage="interruptions">
      <div className="admin-page-container interruptions-page-container">
        <div className="dashboard-header-flex interruptions-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">Power advisories</h2>
            <p className="header-subtitle">Outage notices shown on the public home page.</p>
          </div>
          <div className="interruptions-header-pickers">
            <InterruptionLayoutPicker
              activeLayout={viewMode}
              onLayoutChange={setViewMode}
              filterButton={
                <button
                  type="button"
                  className="interruption-filter-inline-btn"
                  onClick={() => setFilterDrawerOpen(true)}
                  aria-label="Open filters"
                  title="Filters"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  {getActiveFiltersCount() > 0 && (
                    <span className="interruption-filter-inline-badge">{getActiveFiltersCount()}</span>
                  )}
                </button>
              }
            />
            <button type="button" className="btn-new-advisory" onClick={openCreate} disabled={saving}>
              + New advisory
            </button>
          </div>
        </div>

        {message && message.type !== 'conflict' && (
          <p
            className="widget-text interruptions-admin-msg"
            data-variant={message.type}
            role="status"
          >
            {message.text}
          </p>
        )}

        {fetchError && !loading && (
          <p className="widget-text interruptions-admin-fetch-err" role="alert">
            {fetchError}{' '}
            <button type="button" className="interruptions-admin-inline-link" onClick={() => fetchList()}>
              Retry
            </button>
          </p>
        )}

        <div className="interruptions-filter-strip-wrap">
          <div className="interruptions-admin-toolbar-row">
            <InterruptionAdvisoryFilters
              activeChipKey={activeChipKey}
              onChipChange={setActiveChipKey}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <div className="interruptions-admin-archive-scope" role="group" aria-label="Advisory list scope">
              <span className="interruptions-admin-archive-scope-label">Show</span>
              {[
                {
                  key: 'active',
                  label: 'Active',
                  title: 'Advisories currently on the public bulletin or scheduled to appear (not archived)',
                },
                { key: 'all', label: 'All', title: 'All advisories including archived' },
                {
                  key: 'archived',
                  label: 'Archived',
                  title: 'Soft-deleted advisories; view or restore only',
                },
              ].map(({ key, label, title }) => (
                <button
                  key={key}
                  type="button"
                  className={`interruptions-admin-archive-chip${listArchiveFilter === key ? ' interruptions-admin-archive-chip--active' : ''}`}
                  onClick={() => setListArchiveFilter(key)}
                  disabled={loading}
                  title={title}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--refresh"
              onClick={() => fetchList()}
              disabled={loading}
              title="Reload advisories from the server"
            >
              {loading ? 'Loading…' : 'Refresh list'}
            </button>
          </div>
        </div>

        <RecentOpenedAdvisories
          advisories={interruptions}
          recentIds={recentIds}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onSelectAdvisory={openEdit}
          listArchiveFilter={listArchiveFilter}
          onRestoreAdvisory={handleRestoreFromDetailModal}
          onPullFromFeed={pullFromFeedAdvisory}
          onPushToFeed={pushToFeedAdvisory}
          onDelete={handleArchiveRequest}
          onPermanentDelete={(id) => {
            const row = interruptions.find((i) => i.id === id);
            setPermanentDeleteConfirm({ id, feeder: String(row?.feeder || '').trim() || `Advisory #${id}` });
          }}
          saving={saving}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((v) => !v)}
        />

        <div className="main-content-card interruptions-admin-content-card">
        {viewMode === 'card' && (
          <InterruptionAdvisoryBoard
            loading={loading}
            items={filteredInterruptions}
            totalCount={interruptions.length}
            listArchiveFilter={listArchiveFilter}
            onEdit={openEdit}
            onUpdate={openUpdate}
            onOpenAdvisory={addOpened}
            onRestoreAdvisory={handleRestoreFromDetailModal}
            onDelete={handleArchiveRequest}
            onPermanentDelete={(id) => {
              const row = interruptions.find((i) => i.id === id);
              setPermanentDeleteConfirm({ id, feeder: String(row?.feeder || '').trim() || `Advisory #${id}` });
            }}
            onPullFromFeed={pullFromFeedAdvisory}
            onPushToFeed={pushToFeedAdvisory}
            saving={saving}
          />
        )}
        {viewMode === 'compact' && (
          <InterruptionCompactView
            loading={loading}
            items={filteredInterruptions}
            totalCount={interruptions.length}
            listArchiveFilter={listArchiveFilter}
            onEdit={openEdit}
            onUpdate={openUpdate}
            onOpenAdvisory={addOpened}
            onRestoreAdvisory={handleRestoreFromDetailModal}
            onDelete={handleArchiveRequest}
            onPermanentDelete={(id) => {
              const row = interruptions.find((i) => i.id === id);
              setPermanentDeleteConfirm({ id, feeder: String(row?.feeder || '').trim() || `Advisory #${id}` });
            }}
            onPullFromFeed={pullFromFeedAdvisory}
            onPushToFeed={pushToFeedAdvisory}
            saving={saving}
          />
        )}
        {viewMode === 'workflow' && (
          <InterruptionWorkflowView
            loading={loading}
            items={filteredInterruptions}
            totalCount={interruptions.length}
            listArchiveFilter={listArchiveFilter}
            onEdit={openEdit}
            onUpdate={openUpdate}
            onOpenAdvisory={addOpened}
            onRestoreAdvisory={handleRestoreFromDetailModal}
            onDelete={handleArchiveRequest}
            onPermanentDelete={(id) => {
              const row = interruptions.find((i) => i.id === id);
              setPermanentDeleteConfirm({ id, feeder: String(row?.feeder || '').trim() || `Advisory #${id}` });
            }}
            onPullFromFeed={pullFromFeedAdvisory}
            onPushToFeed={pushToFeedAdvisory}
            saving={saving}
          />
        )}
        </div>

        {modalOpen && (
          <div
            className="interruptions-admin-modal-backdrop"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget && !saving) requestCloseModal();
            }}
          >
            <div
              className="interruptions-admin-modal interruptions-admin-modal--flexcol"
              role="dialog"
              aria-modal="true"
              aria-labelledby="interruptions-modal-title"
            >
              <div className="interruptions-admin-modal-header">
                <h3 id="interruptions-modal-title" className="header-title interruptions-admin-modal-title">
                  {advisoryArchived
                    ? `View advisory #${editingId}`
                    : editingId
                      ? `Edit advisory #${editingId}`
                      : 'New power advisory'}
                </h3>
                <button
                  type="button"
                  className="interruptions-admin-modal-close interruptions-admin-btn"
                  onClick={requestCloseModal}
                  disabled={saving}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {advisoryArchived ? (
                <InterruptionAdvisoryViewOnly
                  detail={editDetail}
                  loading={detailLoading}
                  onClose={requestCloseModal}
                  onGeneratePosterStub={handlePosterStub}
                  onCapturePoster={handlePosterCapture}
                  posterAssetBusy={posterAssetBusy}
                />
              ) : (
              <InterruptionAdvisoryForm
                form={form}
                setForm={setForm}
                onSubmit={handleSubmit}
                validationErrors={validationErrors}
                onCancel={requestCloseModal}
                editingId={editingId}
                detailLoading={detailLoading}
                saving={saving}
                saveConflict={message?.type === 'conflict'}
                onReloadAdvisory={handleReloadAdvisory}
                advisoryArchived={advisoryArchived}
                onUpdatePoster={editingId && form.type !== 'CustomPoster' ? handlePosterCapture : undefined}
                posterUpdateRequired={posterUpdateRequired}
                posterAssetBusy={posterAssetBusy}
              />
              )}
            </div>
          </div>
        )}

        {discardConfirmOpen && (
          <div
            className="interruptions-admin-modal-backdrop interruptions-admin-modal-backdrop--confirm"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget && !saving) setDiscardConfirmOpen(false);
            }}
          >
            <div
              className="interruptions-admin-modal interruptions-admin-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="discard-confirm-title"
            >
              <h3 id="discard-confirm-title" className="header-title interruptions-admin-confirm-title">
                Discard unsaved changes?
              </h3>
              <p className="widget-text interruptions-admin-confirm-lead">
                You have unsaved changes. If you close now, they will be lost. Are you sure you want to discard?
              </p>
              <div className="interruptions-admin-confirm-actions">
                <button
                  type="button"
                  className="interruptions-admin-btn"
                  onClick={() => setDiscardConfirmOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--danger"
                  onClick={confirmDiscardAndClose}
                  disabled={saving}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {archiveConfirm && (
          <div
            className="interruptions-admin-modal-backdrop interruptions-admin-modal-backdrop--confirm"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget && !saving) setArchiveConfirm(null);
            }}
          >
            <div
              className="interruptions-admin-modal interruptions-admin-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-confirm-title"
            >
              <h3 id="archive-confirm-title" className="header-title interruptions-admin-confirm-title">
                Archive this advisory?
              </h3>
              <p className="widget-text interruptions-admin-confirm-lead">
                <strong>{archiveConfirm.feeder}</strong> (reference #{archiveConfirm.id})
              </p>
              <ul className="interruptions-admin-confirm-bullets">
                <li>Hidden from the public Power Outages bulletin</li>
                <li>Row and timestamps kept for reporting and exports</li>
                <li>Remarks and audit trail are retained</li>
                <li>You can restore it later from the Archived list</li>
              </ul>
              <div className="interruptions-admin-confirm-actions">
                <button
                  type="button"
                  className="interruptions-admin-btn"
                  onClick={() => setArchiveConfirm(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--danger"
                  onClick={confirmArchive}
                  disabled={saving}
                >
                  {saving ? 'Working…' : 'Archive advisory'}
                </button>
              </div>
            </div>
          </div>
        )}

        <InterruptionFilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
        >
          <div className="interruption-filter-drawer-inner">
            <InterruptionAdvisoryFilters
              activeChipKey={activeChipKey}
              onChipChange={setActiveChipKey}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <div className="interruption-filter-drawer-archive-scope" role="group" aria-label="Advisory list scope">
              <span className="interruption-filter-drawer-scope-label">Show</span>
              <div className="interruption-filter-drawer-scope-chips">
                {[
                  {
                    key: 'active',
                    label: 'Active',
                    title: 'Advisories currently on the public bulletin or scheduled to appear (not archived)',
                  },
                  { key: 'all', label: 'All', title: 'All advisories including archived' },
                  {
                    key: 'archived',
                    label: 'Archived',
                    title: 'Soft-deleted advisories; view or restore only',
                  },
                ].map(({ key, label, title }) => (
                  <button
                    key={key}
                    type="button"
                    className={`interruptions-admin-archive-chip${listArchiveFilter === key ? ' interruptions-admin-archive-chip--active' : ''}`}
                    onClick={() => setListArchiveFilter(key)}
                    disabled={loading}
                    title={title}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="interruption-filter-drawer-actions">
              {getActiveFiltersCount() > 0 && (
                <button
                  type="button"
                  className="interruption-filter-drawer-clear-btn"
                  onClick={() => {
                    setActiveChipKey('all');
                    setSearchQuery('');
                  }}
                  title="Clear all filters"
                  aria-label="Clear all filters"
                >
                  ✕ Clear All
                </button>
              )}
              <button
                type="button"
                className="interruption-filter-drawer-reset-btn"
                onClick={() => {
                  setActiveChipKey('all');
                  setSearchQuery('');
                }}
                title="Reset filters"
                aria-label="Reset all filters"
              >
                ↻ Reset
              </button>
              <button
                type="button"
                className="interruption-filter-drawer-refresh-btn"
                onClick={() => {
                  fetchList();
                  setFilterDrawerOpen(false);
                }}
                disabled={loading}
                title="Reload advisories from the server"
                aria-label="Refresh advisories list"
              >
                ↻ {loading ? 'Loading…' : 'Refresh list'}
              </button>
            </div>
          </div>
        </InterruptionFilterDrawer>

        {updateModalId && (
          <UpdateAdvisoryModal
            item={editDetail || interruptions.find((i) => i.id === updateModalId)}
            updates={editDetail?.updates ?? []}
            detailLoading={detailLoading}
            saving={saving}
            memoSaving={memoSaving}
            memoMessage={memoMessage}
            saveMessage={message}
            onClearSaveMessage={() => setMessage(null)}
            onAddMemo={addMemo}
            onSaveStatus={handleSaveStatus}
            onClose={closeUpdateModal}
          />
        )}

        {permanentDeleteConfirm && (
          <div
            className="interruptions-admin-modal-backdrop interruptions-admin-modal-backdrop--confirm"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget && !saving) setPermanentDeleteConfirm(null);
            }}
          >
            <div
              className="interruptions-admin-modal interruptions-admin-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="permanent-delete-confirm-title"
            >
              <h3 id="permanent-delete-confirm-title" className="header-title interruptions-admin-confirm-title">
                Permanently delete this advisory?
              </h3>
              <p className="widget-text interruptions-admin-confirm-lead">
                <strong>{permanentDeleteConfirm.feeder}</strong> (reference #{permanentDeleteConfirm.id})
              </p>
              <ul className="interruptions-admin-confirm-bullets">
                <li>This will remove the advisory and all its remarks from the database</li>
                <li>This action cannot be undone</li>
              </ul>
              <div className="interruptions-admin-confirm-actions">
                <button
                  type="button"
                  className="interruptions-admin-btn"
                  onClick={() => setPermanentDeleteConfirm(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--danger"
                  onClick={confirmPermanentDelete}
                  disabled={saving}
                >
                  {saving ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminInterruptions;
