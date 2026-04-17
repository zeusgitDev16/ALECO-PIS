import React from 'react';
import '../../CSS/ServiceMemos.css';
import ServiceMemoCard from './ServiceMemoCard';

const MemoBody = ({ memos, loading, activeTab, onView, onEdit, onClose, onPrint, currentUserEmail }) => {
  return (
    <div className="memo-body-container">
      <div className="memo-body-content">
        {loading ? (
          <p className="widget-text service-memos-loading">Loading service memos…</p>
        ) : !memos.length ? (
          <div className="placeholder-content service-memos-placeholder">
            <h3>No service memos</h3>
            <p className="widget-text">
              {activeTab === 'draft'
                ? 'No draft service memos.'
                : activeTab === 'saved'
                  ? 'No saved service memos.'
                  : activeTab === 'closed'
                    ? 'No closed service memos.'
                    : 'No service memos in the system yet.'}
            </p>
          </div>
        ) : (
          <div className="service-memo-card-grid">
            {memos.map((memo) => (
              <ServiceMemoCard
                key={memo.id}
                memo={memo}
                onView={onView}
                onEdit={onEdit}
                onClose={onClose}
                onPrint={onPrint}
                currentUserEmail={currentUserEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoBody;
