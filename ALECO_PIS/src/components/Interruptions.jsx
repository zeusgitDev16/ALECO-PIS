import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/Buttons.css';
import '../CSS/InterruptionsAdmin.css';
import { FILTER_CHIPS } from '../utils/interruptionLabels';
import { emptyForm, buildInterruptionPayload, rowToFormState, validateInterruptionForm } from '../utils/interruptionFormUtils';
import { useAdminInterruptions } from '../hooks/useAdminInterruptions';
import InterruptionAdvisoryFilters from './interruptions/InterruptionAdvisoryFilters';
import InterruptionAdvisoryForm from './interruptions/InterruptionAdvisoryForm';
import InterruptionAdvisoryViewOnly from './interruptions/InterruptionAdvisoryViewOnly';
import InterruptionAdvisoryBoard from './interruptions/InterruptionAdvisoryBoard';
import InterruptionCompactView from './interruptions/InterruptionCompactView';
import InterruptionWorkflowView from './interruptions/InterruptionWorkflowView';
import InterruptionLayoutPicker from './interruptions/InterruptionLayoutPicker';
import InterruptionAdvisoryUpdates from './interruptions/InterruptionAdvisoryUpdates';
import InterruptionFilterDrawer from './interruptions/InterruptionFilterDrawer';
import '../CSS/InterruptionLayoutPicker.css';
import '../CSS/InterruptionWorkflowView.css';
import '../CSS/InterruptionFilterDrawer.css';

const AdminInterruptions = () => {
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
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('interruptionViewMode', viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (modalOpen && editingId) {
      loadEditDetail(editingId);
    } else {
      clearEditDetail();
    }
  }, [modalOpen, editingId, loadEditDetail, clearEditDetail]);

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
    setResolveConfirmOpen(false);
    setPendingSubmit(null);
    setDiscardConfirmOpen(false);
    formLoadedForIdRef.current = null;
  }, []);

  const requestCloseModal = useCallback(() => {
    if (saving) return;
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    doCloseModal();
  }, [saving, isDirty, doCloseModal]);

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
      list = list.filter((i) => i.status === chip.apiStatus);
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
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm(emptyForm);
    setBaselineForm(null);
    setMessage(null);
    setValidationErrors([]);
    setModalOpen(true);
  };

  const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    if (validationErrors.length === 0) return;
    const id = setTimeout(() => {
      setValidationErrors([]);
      setMessage(null);
    }, 2000);
    return () => clearTimeout(id);
  }, [validationErrors, setMessage]);

  useEffect(() => {
    if (listArchiveFilter === 'archived') setActiveChipKey('all');
  }, [listArchiveFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const baselineStatus = baselineForm?.status ?? editDetail?.status;
    const errors = validateInterruptionForm(form, { baselineStatus });
    if (errors.length > 0) {
      setValidationErrors(errors);
      setMessage({ type: 'err', text: errors.join(' ') });
      return;
    }
    setValidationErrors([]);
    const payload = buildInterruptionPayload(form, {
      editingId,
      baselineUpdatedAt: editingId ? editDetail?.updatedAt : null,
      baselineStatus,
    });
    if (payload.status === 'Restored') {
      if (!payload.dateTimeRestored || !String(payload.dateTimeRestored).trim()) {
        setValidationErrors(['Enter the actual restoration date and time before marking as Resolved.']);
        setMessage({ type: 'err', text: 'Enter the actual restoration date and time before marking as Resolved.' });
        return;
      }
      if (baselineStatus !== 'Restored' && !resolveConfirmOpen) {
        setPendingSubmit({ payload, baselineStatus });
        setResolveConfirmOpen(true);
        return;
      }
    }
    const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
    const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
    if (userEmail) payload.actorEmail = userEmail;
    if (userName) payload.actorName = userName;
    const r = await saveAdvisory({ editingId, payload });
    if (r.saved) doCloseModal();
  };

  const confirmResolveAndSave = async () => {
    if (!pendingSubmit) return;
    const { payload } = pendingSubmit;
    const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
    const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
    if (userEmail) payload.actorEmail = userEmail;
    if (userName) payload.actorName = userName;
    setResolveConfirmOpen(false);
    const r = await saveAdvisory({ editingId, payload });
    setPendingSubmit(null);
    if (r.saved) doCloseModal();
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

        <div className="main-content-card interruptions-admin-content-card">
        {viewMode === 'card' && (
          <InterruptionAdvisoryBoard
            loading={loading}
            items={filteredInterruptions}
            totalCount={interruptions.length}
            listArchiveFilter={listArchiveFilter}
            onEdit={openEdit}
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
                />
              ) : (
              <InterruptionAdvisoryForm
                form={form}
                setForm={setForm}
                onSubmit={handleSubmit}
                validationErrors={validationErrors}
                onCancel={requestCloseModal}
                editingId={editingId}
                baselineStatus={baselineForm?.status ?? editDetail?.status}
                detailLoading={detailLoading}
                saving={saving}
                saveConflict={message?.type === 'conflict'}
                onReloadAdvisory={handleReloadAdvisory}
                advisoryArchived={advisoryArchived}
                memoSlot={
                  editingId && form.status === 'Restored' ? (
                    <InterruptionAdvisoryUpdates
                      interruptionId={editingId}
                      updates={editDetail?.updates ?? []}
                      createdAt={editDetail?.createdAt}
                      detailLoading={detailLoading}
                      memoSaving={memoSaving}
                      memoMessage={memoMessage}
                      onAddMemo={addMemo}
                      archivedReadOnly={advisoryArchived}
                    />
                  ) : null
                }
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

        {resolveConfirmOpen && pendingSubmit && (
          <div
            className="interruptions-admin-modal-backdrop interruptions-admin-modal-backdrop--confirm"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget && !saving) {
                setResolveConfirmOpen(false);
                setPendingSubmit(null);
              }
            }}
          >
            <div
              className="interruptions-admin-modal interruptions-admin-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="resolve-confirm-title"
            >
              <h3 id="resolve-confirm-title" className="header-title interruptions-admin-confirm-title">
                Mark as Resolved?
              </h3>
              <p className="widget-text interruptions-admin-confirm-lead">
                This advisory will display on the public bulletin for 1 day 12 hours, then automatically move to Archive.
              </p>
              <p className="widget-text">Confirm that power has been restored and you want to mark this advisory as Resolved.</p>
              <div className="interruptions-admin-confirm-actions">
                <button
                  type="button"
                  className="interruptions-admin-btn"
                  onClick={() => {
                    setResolveConfirmOpen(false);
                    setPendingSubmit(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--submit"
                  onClick={confirmResolveAndSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Yes, mark as Resolved'}
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
