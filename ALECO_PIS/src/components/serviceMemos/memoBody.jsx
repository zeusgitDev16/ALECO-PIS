import React, { useState, useEffect, useCallback } from 'react';
import '../../CSS/ServiceMemos.css';
import '../../CSS/TicketTableView.css';
import ServiceMemoCard from './ServiceMemoCard';

const MemoBody = ({ memos, loading, activeTab, onView, onEdit, onClose, onRequestDelete, onPrint, currentUserEmail }) => {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const toggleSelect = useCallback((memoId) => {
    setSelectedIds((prev) => (prev.includes(memoId) ? prev.filter((id) => id !== memoId) : [...prev, memoId]));
  }, []);

  const selectAll = useCallback(() => {
    if (!memos.length) return;
    if (selectedIds.length === memos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(memos.map((m) => m.id));
    }
  }, [memos, selectedIds.length]);

  const allSelected = memos.length > 0 && selectedIds.length === memos.length;

  return (
    <div className="memo-body-container">
      <div className="memo-body-content">
        {loading ? (
          <p className="widget-text service-memos-loading">Loading service memos…</p>
        ) : !memos.length ? (
          <div className="placeholder-content service-memos-placeholder">
            <h3>No service memos</h3>
            <p className="widget-text">
              {activeTab === 'saved'
                ? 'No saved service memos.'
                : activeTab === 'closed'
                  ? 'No closed service memos.'
                  : 'No service memos in the system yet.'}
            </p>
          </div>
        ) : (
          <div className="service-memo-table-wrap">
            <table className="service-memo-table" role="grid">
              <thead className="service-memo-table-head">
                <tr>
                  <th className="service-memo-table-th" scope="col">
                    Memo # / Ticket
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Customer
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Location
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Category
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Memo
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Ticket
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Received by
                  </th>
                  <th className="service-memo-table-th" scope="col">
                    Created
                  </th>
                  <th className="service-memo-table-th service-memo-table-th--actions" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {memos.map((memo) => (
                  <ServiceMemoCard
                    key={memo.id}
                    memo={memo}
                    onView={onView}
                    onEdit={onEdit}
                    onClose={onClose}
                    onRequestDelete={onRequestDelete}
                    onPrint={onPrint}
                    currentUserEmail={currentUserEmail}
                    selected={selectedIds.includes(memo.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoBody;
