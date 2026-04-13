import React, { useState, useMemo, useEffect } from 'react';
import { listB2BInbound, refreshB2BInbound } from '../../api/b2bMailApi';

const MESSAGE_STATUS = {
  sent: { label: 'Sent', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  delivered: { label: 'Delivered', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  draft: { label: 'Draft', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  scheduled: { label: 'Scheduled', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
};

const TARGET_TYPE_LABELS = {
  all_feeders: 'All Feeders',
  selected_feeders: 'Selected Feeders',
  manual_contacts: 'Manual Contacts',
  interruption_linked: 'Interruption-Linked',
};

/**
 * Comprehensive Messages View with layered UI
 * @param {object} props
 * @param {Array} props.messages - List of messages
 * @param {boolean} props.loading - Loading state
 * @param {() => void} props.onRefresh - Refresh handler
 * @param {(id: number) => void} props.onViewDetails - View message details
 */
export default function B2BMessagesView({
  messages,
  allMessages,
  loading,
  onRefresh,
  onViewDetails,
  showLogs,
  stats,
  hasDraftMessages,
}) {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [inboundReplies, setInboundReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [refreshingReplies, setRefreshingReplies] = useState(false);

  const handleRefreshReplies = async () => {
    if (!selectedMessage?.id || refreshingReplies) return;
    setRefreshingReplies(true);
    try {
      const res = await refreshB2BInbound({ messageId: selectedMessage.id });
      if (res.success && Array.isArray(res.data)) {
        setInboundReplies(res.data);
      }
    } finally {
      setRefreshingReplies(false);
    }
  };

  // Fetch inbound replies when a message is selected
  useEffect(() => {
    if (!selectedMessage?.id) {
      setInboundReplies([]);
      return;
    }
    let isMounted = true;
    const fetchReplies = async () => {
      setLoadingReplies(true);
      const res = await listB2BInbound({ messageId: selectedMessage.id });
      if (isMounted) {
        if (res.success && Array.isArray(res.data)) {
          setInboundReplies(res.data);
        } else {
          setInboundReplies([]);
        }
        setLoadingReplies(false);
      }
    };
    fetchReplies();
    return () => { isMounted = false; };
  }, [selectedMessage?.id]);

  // Generate activity logs from messages
  const logs = useMemo(() => {
    return (allMessages || messages)
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        timestamp: m.created_at,
        action:
          m.status === 'sent'
            ? 'Message Sent'
            : m.status === 'delivered'
              ? 'Message Delivered'
              : m.status === 'failed'
                ? 'Send Failed'
                : m.status === 'draft'
                  ? 'Draft Created'
                  : 'Message Updated',
        details: m.subject || '(No subject)',
        status: m.status,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [allMessages, messages]);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
    if (onViewDetails) onViewDetails(message.id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  return (
    <div className="b2b-messages-pool">
      {/* Header with Stats */}
      <div className="b2b-messages-header">
        <div className="b2b-messages-stats">
          <div className="b2b-messages-stat total">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="b2b-messages-stat sent">
            <span className="stat-value">{stats.sent}</span>
            <span className="stat-label">Sent</span>
          </div>
          <div className="b2b-messages-stat delivered">
            <span className="stat-value">{stats.delivered}</span>
            <span className="stat-label">Delivered</span>
          </div>
          <div className="b2b-messages-stat failed">
            <span className="stat-value">{stats.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
          {hasDraftMessages && (
            <div className="b2b-messages-stat draft">
              <span className="stat-value">{stats.draft}</span>
              <span className="stat-label">Drafts</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="b2b-messages-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh messages"
        >
          ↻
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`b2b-messages-content ${showLogs ? 'with-logs' : ''}`}>
        {/* Messages List */}
        <div className="b2b-messages-list-container">
          {loading ? (
            <div className="b2b-messages-loading">
              <div className="spinner" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="b2b-messages-empty">
              <div className="empty-icon">✉</div>
              <p>No messages found</p>
              <span>Try adjusting your filters or compose a new message</span>
            </div>
          ) : (
            <div className="b2b-messages-list">
              {messages.map((message) => {
                const status = MESSAGE_STATUS[message.status] || {
                  label: message.status || 'Unknown',
                  color: 'var(--text-secondary)',
                  bg: 'color-mix(in srgb, var(--text-secondary) 15%, transparent)',
                };

                return (
                  <div
                    key={message.id}
                    className="b2b-message-card"
                    onClick={() => handleMessageClick(message)}
                  >
                    <div className="message-card-header">
                      <div
                        className="message-status-indicator"
                        style={{ background: status.color }}
                      />
                      <span className="message-subject">
                        {message.subject || '(No subject)'}
                      </span>
                      <span
                        className="message-status-badge"
                        style={{ color: status.color, background: status.bg }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="message-card-body">
                      <p className="message-preview">
                        {message.body_text
                          ? message.body_text.substring(0, 100) +
                            (message.body_text.length > 100 ? '...' : '')
                          : 'No content'}
                      </p>
                    </div>

                    <div className="message-card-footer">
                      <div className="message-meta">
                        <span className="message-target">
                          {TARGET_TYPE_LABELS[message.target_mode] || 'Unknown'}
                        </span>
                        <span className="message-recipients">
                          {message.recipients_count
                            ? `${message.recipients_count} recipient${message.recipients_count > 1 ? 's' : ''}`
                            : 'No recipients'}
                        </span>
                      </div>
                      <span className="message-time">
                        {formatRelativeTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Details Modal */}
        {selectedMessage && (
          <div
            className="b2b-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedMessage(null);
            }}
          >
            <div className="b2b-modal b2b-message-detail-modal">
              <div className="detail-header">
                <h4>Message Details</h4>
                <button
                  type="button"
                  className="close-detail"
                  onClick={() => setSelectedMessage(null)}
                >
                  ×
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-row">
                  <label>Subject</label>
                  <span>{selectedMessage.subject || '(No subject)'}</span>
                </div>
                <div className="detail-row">
                  <label>Status</label>
                  <span className="detail-status">
                    {MESSAGE_STATUS[selectedMessage.status]?.label || selectedMessage.status}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Target</label>
                  <span>{TARGET_TYPE_LABELS[selectedMessage.target_mode] || 'Unknown'}</span>
                </div>
                <div className="detail-row">
                  <label>Recipients</label>
                  <span>{selectedMessage.recipients_count || 0}</span>
                </div>
                <div className="detail-row">
                  <label>Created</label>
                  <span>{formatDate(selectedMessage.created_at)}</span>
                </div>
                {selectedMessage.sent_at && (
                  <div className="detail-row">
                    <label>Sent</label>
                    <span>{formatDate(selectedMessage.sent_at)}</span>
                  </div>
                )}
                <div className="detail-message-body">
                  <label>Original Message Content</label>
                  <pre>{selectedMessage.body_text || 'No content'}</pre>
                </div>

                {/* Inbound Replies Thread */}
                <div className="b2b-inbound-replies">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Replies ({inboundReplies.length})</label>
                    <button
                      type="button"
                      onClick={handleRefreshReplies}
                      disabled={refreshingReplies || loadingReplies}
                      style={{
                        marginLeft: 'auto', fontSize: '0.75rem', padding: '2px 10px',
                        borderRadius: '6px', border: '1px solid var(--border-color, #ddd)',
                        background: 'var(--surface, #fff)', cursor: refreshingReplies ? 'wait' : 'pointer',
                        color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                      title="Poll inbox for new replies"
                    >
                      <span style={{ display: 'inline-block', animation: refreshingReplies ? 'spin 1s linear infinite' : 'none' }}>↻</span>
                      {refreshingReplies ? 'Checking…' : 'Refresh Replies'}
                    </button>
                  </div>
                  {loadingReplies ? (
                    <div className="replies-loading">Loading replies...</div>
                  ) : inboundReplies.length === 0 ? (
                    <div className="replies-empty">No replies received yet.</div>
                  ) : (
                    <div className="replies-list">
                      {inboundReplies.map((reply) => (
                        <div key={reply.id} className="reply-card">
                          <div className="reply-header">
                            <span className="reply-from">{reply.from_email || 'Unknown sender'}</span>
                            <span className="reply-date">{formatRelativeTime(reply.received_at)}</span>
                          </div>
                          {reply.subject && (
                            <div className="reply-subject">Re: {reply.subject.replace(/^(Re:\s*)+/i, '')}</div>
                          )}
                          <pre className="reply-body">{reply.body_text || '(No text content)'}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Panel */}
        {showLogs && (
          <div className="b2b-messages-logs">
            <div className="logs-header">
              <h4>Activity Logs</h4>
              <span className="logs-count">{logs.length} entries</span>
            </div>
            <div className="logs-list">
              {logs.map((log) => (
                <div key={log.id} className={`log-item ${log.status}`}>
                  <div className="log-timestamp">
                    {formatRelativeTime(log.timestamp)}
                  </div>
                  <div className="log-action">{log.action}</div>
                  <div className="log-details">{log.details}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
