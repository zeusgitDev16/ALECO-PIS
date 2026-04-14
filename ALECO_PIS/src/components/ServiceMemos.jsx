import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/ServiceMemos.css';
import { useServiceMemos } from '../hooks/useServiceMemos';
import ServiceMemoTabs from './serviceMemos/ServiceMemoTabs';
import ServiceMemoCard from './serviceMemos/ServiceMemoCard';
import ServiceMemoModal from './serviceMemos/ServiceMemoModal';
import ServiceMemoFilters from './serviceMemos/ServiceMemoFilters';

const ServiceMemos = () => {
  const {
    memos,
    loading,
    saving,
    message,
    setMessage,
    fetchError,
    fetchList,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    updateMemo,
    closeMemo,
  } = useServiceMemos();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Listen for service memo deletion event
  useEffect(() => {
    const handleServiceMemoDeleted = () => {
      fetchList();
    };

    window.addEventListener('service-memo-deleted', handleServiceMemoDeleted);

    return () => {
      window.removeEventListener('service-memo-deleted', handleServiceMemoDeleted);
    };
  }, [fetchList]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleEditMemo = (memoId) => {
    setEditingMemoId(memoId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingMemoId(null);
    setMessage(null);
  };

  const handleSaveMemo = async (memoData) => {
    if (editingMemoId) {
      const result = await updateMemo(editingMemoId, memoData);
      if (result.saved) {
        handleCloseModal();
      }
    }
  };

  const handleCloseMemo = async (memoId) => {
    const result = await closeMemo(memoId);
    if (result.closed) {
      setMessage({ type: 'ok', text: 'Service memo closed successfully.' });
    }
  };

  return (
    <AdminLayout activePage="service-memos">
      <div className="admin-page-container service-memos-page-container">
        <div className="dashboard-header-flex service-memos-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">Service Memos</h2>
            <p className="header-subtitle">Documentation for resolved tickets</p>
          </div>
          <div className="service-memos-header-pickers">
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
            <button
              type="button"
              className="interruptions-admin-btn"
              onClick={() => fetchList()}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh list'}
            </button>
          </div>
        </div>

        {message && (
          <p
            className="widget-text service-memos-msg"
            data-variant={message.type}
            role="status"
          >
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

        <ServiceMemoTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="main-content-card service-memos-content-card">
          {loading ? (
            <p className="widget-text service-memos-loading">Loading service memos…</p>
          ) : !memos.length ? (
            <div className="placeholder-content service-memos-placeholder">
              <h3>No service memos</h3>
              <p className="widget-text">
                {activeTab === 'draft'
                  ? 'No draft service memos. Drafts are created when you close a ticket.'
                  : activeTab === 'saved'
                  ? 'No saved service memos. Save your drafts to prepare for printing.'
                  : activeTab === 'closed'
                  ? 'No closed service memos. Closed memos are completed and finalized.'
                  : 'No service memos in the system yet.'}
              </p>
            </div>
          ) : (
            <div className="service-memo-card-grid">
              {memos.map((memo) => (
                <ServiceMemoCard
                  key={memo.id}
                  memo={memo}
                  onEdit={handleEditMemo}
                  onClose={handleCloseMemo}
                  onPrint={() => window.print()}
                  activeTab={activeTab}
                  currentUserEmail={localStorage.getItem('userEmail')}
                />
              ))}
            </div>
          )}
        </div>

        {/* ServiceMemoModal */}
        {modalOpen && editingMemoId && (
          <ServiceMemoModal
            memo={memos.find(m => m.id === editingMemoId)}
            isOpen={modalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveMemo}
            onCloseMemo={handleCloseMemo}
            currentUserEmail={localStorage.getItem('userEmail')}
          />
        )}

        {/* ServiceMemoFilters */}
        {filterDrawerOpen && (
          <ServiceMemoFilters
            filters={filters}
            onFilterChange={setFilters}
            onClose={() => setFilterDrawerOpen(false)}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default ServiceMemos;
