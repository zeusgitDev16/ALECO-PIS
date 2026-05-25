import React, { useState, useEffect, useCallback } from 'react';
import '../CSS/AdminPageLayout.css';
import '../CSS/ServiceMemos.css';
import '../CSS/ServiceMemoUIScale.css';
import { useServiceMemos } from '../hooks/useServiceMemos';
import { useServiceMemoPrint } from '../hooks/useServiceMemoPrint';
import MemoHeader from './serviceMemos/memoHeader';
import MemoBody from './serviceMemos/memoBody';
import ServiceMemoFilters from './serviceMemos/ServiceMemoFilters';
import ServiceMemoForm from './serviceMemos/ServiceMemoForm';
import ConfirmModal from './tickets/ConfirmModal';
import { getServiceMemo } from '../api/serviceMemosApi';
import { apiUrl } from '../utils/api';
import { authMutation } from '../utils/authMutation';
import { REALTIME_MODULES } from '../constants/realtimeModules';
import { matchesRealtimeModule } from '../utils/realtimeModules';

const ServiceMemos = () => {
  const {
    memos,
    loading,
    message,
    setMessage,
    fetchError,
    fetchList,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    closeMemo,
    deleteMemo,
  } = useServiceMemos();

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailMode, setDetailMode] = useState('view');
  const [activeMemoId, setActiveMemoId] = useState(null);
  const [detailMemo, setDetailMemo] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;

  const { printMemo, isLoading: isPrinting, error: printError } = useServiceMemoPrint();

  useEffect(() => {
    const handleServiceMemoDeleted = () => {
      fetchList();
    };
    window.addEventListener('service-memo-deleted', handleServiceMemoDeleted);
    return () => window.removeEventListener('service-memo-deleted', handleServiceMemoDeleted);
  }, [fetchList]);

  useEffect(() => {
    const onRealtimeChange = (ev) => {
      if (matchesRealtimeModule(
        ev?.detail?.module,
        REALTIME_MODULES.SERVICE_MEMOS,
        REALTIME_MODULES.TICKETS,
        REALTIME_MODULES.DATA_MANAGEMENT,
        REALTIME_MODULES.SYSTEM
      )) {
        fetchList();
      }
    };
    window.addEventListener('aleco:realtime-change', onRealtimeChange);
    return () => window.removeEventListener('aleco:realtime-change', onRealtimeChange);
  }, [fetchList]);

  // Handle custom event to open specific memo
  useEffect(() => {
    const handleOpenServiceMemo = async (ev) => {
      const { memoId, mode = 'view' } = ev.detail || {};
      if (memoId) {
        setActiveMemoId(memoId);
        setDetailMode(mode === 'edit' ? 'update' : 'view');
        setDetailLoading(true);
        setDetailMemo(null);
        try {
          const r = await getServiceMemo(memoId);
          if (r.success && r.data) {
            setDetailMemo(r.data);
          } else {
            setMessage({ type: 'err', text: r.message || 'Could not load memo.' });
          }
        } finally {
          setDetailLoading(false);
        }
      }
    };
    window.addEventListener('aleco:open-service-memo', handleOpenServiceMemo);
    return () => window.removeEventListener('aleco:open-service-memo', handleOpenServiceMemo);
  }, [setMessage]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setDetailMemo(null);
    try {
      const r = await getServiceMemo(id);
      if (r.success && r.data) {
        setDetailMemo(r.data);
      } else {
        setMessage({ type: 'err', text: r.message || 'Could not load memo.' });
      }
    } finally {
      setDetailLoading(false);
    }
  }, [setMessage]);

  useEffect(() => {
    if (activeMemoId) {
      loadDetail(activeMemoId);
    }
  }, [activeMemoId, loadDetail]);

  const handleViewMemo = (memoId) => {
    setActiveMemoId(memoId);
    setDetailMode('view');
  };

  const handleEditMemo = (memoId) => {
    setActiveMemoId(memoId);
    setDetailMode('update');
  };

  const handleBackFromDetail = () => {
    setActiveMemoId(null);
    setDetailMemo(null);
    fetchList();
  };

  const handleUpdateTicket = async (ticketId, newStatus, dispatchData = null, remarks = null, referredTo = null, replaceRemarks = false, accomplishedBy = null) => {
    try {
      const url = apiUrl(`/api/tickets/${ticketId}/status`);
      const payload = {
        status: newStatus,
      };

      // Add remarks if provided (for resolution statuses)
      if (remarks) {
        payload.remarks = remarks;
      }

      // Add referred_to if provided (for service memo)
      if (referredTo) {
        payload.referred_to = referredTo;
      }

      // Add accomplished_by if provided (for service memo)
      if (accomplishedBy) {
        payload.accomplished_by = accomplishedBy;
      }

      // Add replaceRemarks flag if provided
      if (replaceRemarks) {
        payload.replace_remarks = true;
      }

      const result = await authMutation(url, {
        method: 'PUT',
        body: payload,
        emitRealtime: { module: REALTIME_MODULES.TICKETS },
      });
      const data = result.data || {};

      if (result.success) {
        setMessage({ type: 'ok', text: `Ticket ${ticketId} marked as ${newStatus}.` });
        fetchList();
        return data;
      } else if (result.conflict) {
        setMessage({ type: 'err', text: 'This ticket was already updated by another user. Reloading latest data.' });
        fetchList();
      } else {
        setMessage({ type: 'err', text: "Status update failed: " + data.message });
      }
    } catch (error) {
      console.error("Network error: ", error);
      setMessage({ type: 'err', text: "Network error. Please try again." });
    }
  };

  const handleCloseMemoFromCard = async (memoId, status, remarks, referredTo, accomplishedBy) => {
    const snapshot = memos.find((m) => m.id === memoId);
    if (snapshot?.ticket_id) {
      await handleUpdateTicket(snapshot.ticket_id, status, null, remarks, referredTo, false, accomplishedBy);
      setMessage({ type: 'ok', text: 'Service memo closed successfully.' });
      fetchList();
    }
  };

  const handleRequestDeleteFromList = (m) => {
    setDeleteTarget({
      id: m.id,
      control_number: m.control_number,
      ticket_id: m.ticket_id,
    });
  };

  const handleConfirmDeleteFromList = () => {
    if (deleteTarget?.id != null) void deleteMemo(deleteTarget.id);
  };

  if (activeMemoId) {
    if (detailLoading || !detailMemo) {
      return (
        <div className="admin-page-container service-memos-page-container">
          <p className="widget-text service-memos-loading">{detailLoading ? 'Loading memo…' : 'Memo not found.'}</p>
          <button type="button" className="interruptions-admin-btn" onClick={handleBackFromDetail}>
            Back
          </button>
        </div>
      );
    }

    const formMode = detailMode === 'update' ? 'update' : 'view';

    return (
      <div className="admin-page-container service-memos-page-container">
        <ServiceMemoForm
          mode={formMode}
          memo={detailMemo}
          onBack={handleBackFromDetail}
          onSaved={handleBackFromDetail}
          currentUserEmail={userEmail}
          currentUserName={userName}
          onDeleted={handleBackFromDetail}
          showCloseMemoFinalize={detailMemo.memo_status === 'saved' || detailMemo.memo_status === 'deployed'}
          onSwitchToEdit={() => setDetailMode('update')}
          onReopenMemo={async (memoId) => {
            const { reopenServiceMemo } = await import('../api/serviceMemosApi');
            const result = await reopenServiceMemo(memoId);
            if (result.success) {
              setMessage({ type: 'ok', text: 'Service memo reopened successfully.' });
              fetchList();
              handleBackFromDetail();
            } else {
              setMessage({ type: 'err', text: result.message || 'Failed to reopen memo.' });
            }
          }}
          onCloseMemoFinalize={async (ticketId, status, remarks, referredTo, accomplishedBy) => {
            await handleUpdateTicket(ticketId, status, null, remarks, referredTo, false, accomplishedBy);
            handleBackFromDetail();
          }}
          onPrint={() => printMemo(detailMemo)}
        />
      </div>
    );
  }

  return (
    <div className="admin-page-container service-memos-page-container">
      <div className="service-memos-toolbar">
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
        </button>
      </div>

      {message && (
        <p className="widget-text service-memos-msg" data-variant={message.type} role="status">
          {message.text}
        </p>
      )}

      {printError && (
        <p className="widget-text service-memos-msg" data-variant="err" role="alert">
          Print failed: {printError}
        </p>
      )}

      {fetchError && !loading && (
        <p className="widget-text service-memos-fetch-err" role="alert">
          {fetchError}{' '}
          <button type="button" className="interruptions-admin-inline-link" onClick={() => fetchList()}>
            Retry
          </button>
        </p>
      )}

      <div className="memo-two-pane-layout">
        <MemoHeader filters={filters} setFilters={setFilters} activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={() => fetchList()} loading={loading} />
        <MemoBody
          memos={memos}
          loading={loading}
          activeTab={activeTab}
          onView={handleViewMemo}
          onEdit={handleEditMemo}
          onClose={handleCloseMemoFromCard}
          onRequestDelete={handleRequestDeleteFromList}
          onPrint={printMemo}
          currentUserEmail={userEmail}
          currentUserName={userName}
        />
      </div>

      {filterDrawerOpen && (
        <ServiceMemoFilters filters={filters} onFilterChange={setFilters} onClose={() => setFilterDrawerOpen(false)} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteFromList}
        title="Delete service memo permanently?"
        message={
          deleteTarget
            ? `Memo ${deleteTarget.control_number || `#${deleteTarget.id}`} (ticket ${deleteTarget.ticket_id || '—'}) will be removed from the database. The ticket record's link to this memo will be cleared. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default ServiceMemos;
