import React, { useState, useEffect, useCallback } from 'react';
import '../CSS/AdminPageLayout.css';
import '../CSS/ServiceMemos.css';
import '../CSS/ServiceMemoUIScale.css';
import { useServiceMemos } from '../hooks/useServiceMemos';
import MemoHeader from './serviceMemos/memoHeader';
import MemoBody from './serviceMemos/memoBody';
import ServiceMemoFilters from './serviceMemos/ServiceMemoFilters';
import ServiceMemoForm from './serviceMemos/ServiceMemoForm';
import ConfirmModal from './tickets/ConfirmModal';
import { getServiceMemo } from '../api/serviceMemosApi';
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
  const [screen, setScreen] = useState('browse');
  const [detailMode, setDetailMode] = useState('view');
  const [activeMemoId, setActiveMemoId] = useState(null);
  const [detailMemo, setDetailMemo] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;

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
    if (screen === 'detail' && activeMemoId) {
      loadDetail(activeMemoId);
    }
  }, [screen, activeMemoId, loadDetail]);

  const handleViewMemo = (memoId) => {
    setActiveMemoId(memoId);
    setDetailMode('view');
    setScreen('detail');
  };

  const handleEditMemo = (memoId) => {
    setActiveMemoId(memoId);
    setDetailMode('update');
    setScreen('detail');
  };

  const handleBackFromDetail = () => {
    setScreen('browse');
    setActiveMemoId(null);
    setDetailMemo(null);
    fetchList();
  };

  const handleCreateNew = () => {
    setScreen('create');
    setDetailMemo(null);
    setActiveMemoId(null);
  };

  const handleCloseMemoFromCard = async (memoId) => {
    const result = await closeMemo(memoId);
    if (result.closed) {
      setMessage({ type: 'ok', text: 'Service memo closed successfully.' });
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

  if (screen === 'create') {
    return (
      <div className="admin-page-container service-memos-page-container service-memos-page-container--create-memo">
        <ServiceMemoForm
          mode="create"
          memo={null}
          onBack={() => {
            setScreen('browse');
            fetchList();
          }}
          onSaved={() => {
            setScreen('browse');
            fetchList();
            setMessage({ type: 'ok', text: 'Service memo created.' });
          }}
          currentUserEmail={userEmail}
          currentUserName={userName}
        />
      </div>
    );
  }

  if (screen === 'detail') {
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
          showCloseMemoFinalize={formMode === 'update' && detailMemo.memo_status === 'saved'}
          onCloseMemoFinalize={async () => {
            const r = await closeMemo(detailMemo.id);
            if (r.closed) {
              setMessage({ type: 'ok', text: 'Memo closed.' });
              handleBackFromDetail();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin-page-container service-memos-page-container">
      <div className="service-memos-toolbar">
        <button type="button" className="interruptions-admin-btn" onClick={handleCreateNew}>
          Create memo
        </button>
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
        <button type="button" className="interruptions-admin-btn" onClick={() => fetchList()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh list'}
        </button>
      </div>

      {message && (
        <p className="widget-text service-memos-msg" data-variant={message.type} role="status">
          {message.text}
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
        <MemoHeader filters={filters} setFilters={setFilters} activeTab={activeTab} setActiveTab={setActiveTab} />
        <MemoBody
          memos={memos}
          loading={loading}
          activeTab={activeTab}
          onView={handleViewMemo}
          onEdit={handleEditMemo}
          onClose={handleCloseMemoFromCard}
          onRequestDelete={handleRequestDeleteFromList}
          onPrint={() => window.print()}
          currentUserEmail={userEmail}
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
