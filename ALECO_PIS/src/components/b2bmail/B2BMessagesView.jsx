import React, { useState, useMemo } from 'react';

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
export default function B2BMessagesView({ messages, loading, onRefresh, onViewDetails }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    // Status filter
    if (activeFilter !== 'all') {
      result = result.filter((m) => m.status === activeFilter);
    }

    // Date range filter
    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      result = result.filter((m) => new Date(m.created_at) >= fromDate);
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59);
      result = result.filter((m) => new Date(m.created_at) <= toDate);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          (m.subject || '').toLowerCase().includes(query) ||
          (m.body_text || '').toLowerCase().includes(query) ||
          (m.sender_email || '').toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [messages, activeFilter, dateRange, searchQuery, sortBy]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: messages.length,
      sent: messages.filter((m) => m.status === 'sent').length,
      delivered: messages.filter((m) => m.status === 'delivered').length,
      failed: messages.filter((m) => m.status === 'failed').length,
      draft: messages.filter((m) => m.status === 'draft').length,
    };
  }, [messages]);

  // Generate activity logs from messages
  const logs = useMemo(() => {
    return messages
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        timestamp: m.created_at,
        action: m.status === 'sent' ? 'Message Sent' : m.status === 'delivered' ? 'Message Delivered' : m.status === 'failed' ? 'Send Failed' : 'Draft Created',
        details: m.subject || '(No subject)',
        status: m.status,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [messages]);

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
          <div className="b2b-messages-stat draft">
            <span className="stat-value">{stats.draft}</span>
            <span className="stat-label">Drafts</span>
          </div>
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

      {/* Filter Toolbar */}
      <div className="b2b-messages-toolbar">
        <div className="b2b-messages-filters">
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveFilter('sent')}
          >
            Sent
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'delivered' ? 'active' : ''}`}
            onClick={() => setActiveFilter('delivered')}
          >
            Delivered
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'failed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('failed')}
          >
            Failed
          </button>
          <button
            type="button"
            className={`filter-chip ${activeFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveFilter('draft')}
          >
            Drafts
          </button>
        </div>

        <div className="b2b-messages-date-filters">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
            placeholder="From"
            className="date-input"
          />
          <span className="date-separator">→</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
            placeholder="To"
            className="date-input"
          />
        </div>

        <div className="b2b-messages-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="search-input"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="sort-select"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <button
          type="button"
          className={`logs-toggle ${showLogs ? 'active' : ''}`}
          onClick={() => setShowLogs(!showLogs)}
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
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
          ) : filteredMessages.length === 0 ? (
            <div className="b2b-messages-empty">
              <div className="empty-icon">✉</div>
              <p>No messages found</p>
              <span>Try adjusting your filters or compose a new message</span>
            </div>
          ) : (
            <div className="b2b-messages-list">
              {filteredMessages.map((message) => {
                const status = MESSAGE_STATUS[message.status] || MESSAGE_STATUS.draft;
                const isSelected = selectedMessage?.id === message.id;

                return (
                  <div
                    key={message.id}
                    className={`b2b-message-card ${isSelected ? 'selected' : ''}`}
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
                          {message.recipient_count
                            ? `${message.recipient_count} recipient${message.recipient_count > 1 ? 's' : ''}`
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

        {/* Message Detail Panel */}
        {selectedMessage && (
          <div className="b2b-message-detail">
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
                <span
                  className="detail-status"
                  style={{
                    color: MESSAGE_STATUS[selectedMessage.status]?.color,
                  }}
                >
                  {MESSAGE_STATUS[selectedMessage.status]?.label || selectedMessage.status}
                </span>
              </div>
              <div className="detail-row">
                <label>Target</label>
                <span>{TARGET_TYPE_LABELS[selectedMessage.target_mode] || 'Unknown'}</span>
              </div>
              <div className="detail-row">
                <label>Recipients</label>
                <span>{selectedMessage.recipient_count || 0}</span>
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
                <label>Message Content</label>
                <pre>{selectedMessage.body_text || 'No content'}</pre>
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
