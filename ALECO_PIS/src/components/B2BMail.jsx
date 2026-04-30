import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import AdminLayout from './AdminLayout';
import { useB2BContacts } from '../hooks/useB2BContacts';
import { useB2BMessages } from '../hooks/useB2BMessages';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import { FEEDER_AREAS } from '../config/feederConfig';
import B2BContactList from './b2bmail/B2BContactList';
import B2BBulkActionBar from './b2bmail/B2BBulkActionBar';
import B2BContactForm from './b2bmail/B2BContactForm';
import B2BMessageCompose from './b2bmail/B2BMessageCompose';
import B2BMessagesView from './b2bmail/B2BMessagesView';
import B2BDualPaneLayout from './b2bmail/B2BDualPaneLayout';
import B2BFilterSidebar from './b2bmail/B2BFilterSidebar';
import B2BFilterDrawer from './b2bmail/B2BFilterDrawer';
import B2BContactsSidebarFilters from './b2bmail/B2BContactsSidebarFilters';
import B2BMessagesSidebarFilters from './b2bmail/B2BMessagesSidebarFilters';
import '../CSS/AdminPageLayout.css';
import '../CSS/B2BMailPage.css';
import '../CSS/B2BMailUIScale.css';
import '../CSS/B2BFilterLayout.css';

const DEFAULT_CONTACTS_FILTERS = {
  filter: 'all',
  searchQuery: '',
};

const DEFAULT_MESSAGES_FILTERS = {
  status: 'all',
  from: '',
  to: '',
  searchQuery: '',
  sortBy: 'newest',
  showLogs: false,
};

/**
 * Enhanced B2B Mail Dashboard
 * Simplified UI following Tickets/Interruptions patterns
 */
const B2BMail = () => {
  // Hooks
  const {
    contacts,
    allContacts,
    loading: contactsLoading,
    saving,
    message: contactMessage,
    clearMessage: clearContactMessage,
    stats,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectedIds,
    setSelectedIds,
    upsertContact,
    setContactActive,
    sendVerification,
    bulkSendVerification,
    bulkToggleActive,
    loadContacts,
  } = useB2BContacts();

  const {
    messages,
    templates,
    loading: messagesLoading,
    message: composeMessage,
    clearMessage: clearComposeMessage,
    previewResult,
    clearPreview,
    saveDraft,
    sendMessage,
    previewRecipients,
    loadMessages,
  } = useB2BMessages();

  // Local state
  const [feeders, setFeeders] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [messagesFilters, setMessagesFilters] = useState(DEFAULT_MESSAGES_FILTERS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('b2b-filter-sidebar-collapsed');
      if (saved != null) setSidebarCollapsed(saved === '1');
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('b2b-filter-sidebar-collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Load feeders with fallback to config
  useEffect(() => {
    const loadFeeders = async () => {
      try {
        const res = await authFetch(apiUrl('/api/feeders'));
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.areas)) {
          const opts = json.areas.flatMap((a) =>
            (a.feeders || []).map((f) => ({
              id: Number(f.id),
              label: f.label || `${a.label} ${f.code}`,
            }))
          );
          setFeeders(opts);
          return;
        }
      } catch {
        // Fall through to config fallback
      }
      
      // Fallback to FEEDER_AREAS config (same pattern as Interruptions)
      const fallback = FEEDER_AREAS.flatMap((a) =>
        (a.feeders || []).map((f) => ({
          id: null,
          label: `${a.label} ${f}`,
        }))
      );
      setFeeders(fallback);
    };
    loadFeeders();
  }, []);

  // Toast notifications for messages
  useEffect(() => {
    if (contactMessage) {
      if (contactMessage.type === 'ok') {
        toast.success(contactMessage.text);
      } else {
        toast.error(contactMessage.text);
      }
      clearContactMessage();
    }
  }, [contactMessage, clearContactMessage]);

  useEffect(() => {
    if (composeMessage) {
      if (composeMessage.type === 'ok') {
        toast.success(composeMessage.text);
      } else {
        toast.error(composeMessage.text);
      }
      clearComposeMessage();
    }
  }, [composeMessage, clearComposeMessage]);

  useEffect(() => {
    const onRealtimeChange = (ev) => {
      const module = String(ev?.detail?.module || '').toLowerCase();
      if (module === 'b2b-mail' || module === 'data-management' || module === 'system') {
        loadContacts();
        loadMessages();
      }
    };
    window.addEventListener('aleco:realtime-change', onRealtimeChange);
    return () => window.removeEventListener('aleco:realtime-change', onRealtimeChange);
  }, [loadContacts, loadMessages]);

  // Modal handlers
  const openNewContact = () => {
    setEditingContact(null);
    setIsContactModalOpen(true);
  };

  const openEditContact = (contact) => {
    setEditingContact(contact);
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setEditingContact(null);
  };

  const openCompose = () => {
    clearPreview();
    setIsComposeOpen(true);
  };

  const closeCompose = () => {
    setIsComposeOpen(false);
    clearPreview();
  };

  // Bulk action handlers
  const handleBulkSendVerification = () => {
    if (selectedIds.length === 0) return;
    bulkSendVerification(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkToggleActive = () => {
    if (selectedIds.length === 0) return;
    bulkToggleActive(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    let success = 0;
    for (const id of selectedIds) {
      try {
        const res = await authFetch(apiUrl(`/api/b2b-mail/contacts/${id}`), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) success++;
      } catch {
        // ignore
      }
    }
    toast.success(`Deleted ${success} contact(s)`);
    setSelectedIds([]);
    loadContacts();
  };

  // Compose handlers
  const handleSendMessage = async (formData) => {
    const result = await sendMessage(formData);
    if (result?.success) {
      closeCompose();
    }
  };

  const handleSaveDraft = async (formData) => {
    await saveDraft(formData);
    closeCompose();
  };

  const feederOptions = useMemo(() => feeders, [feeders]);

  const hasDraftMessages = useMemo(
    () => messages.some((m) => m.status === 'draft'),
    [messages]
  );

  const messagesStats = useMemo(() => ({
    total: messages.length,
    sent: messages.filter((m) => m.status === 'sent').length,
    delivered: messages.filter((m) => m.status === 'delivered').length,
    failed: messages.filter((m) => m.status === 'failed').length,
    draft: messages.filter((m) => m.status === 'draft').length,
  }), [messages]);

  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (messagesFilters.status !== 'all') {
      result = result.filter((m) => m.status === messagesFilters.status);
    }

    if (messagesFilters.from) {
      const fromDate = new Date(messagesFilters.from);
      result = result.filter((m) => new Date(m.created_at) >= fromDate);
    }
    if (messagesFilters.to) {
      const toDate = new Date(messagesFilters.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((m) => new Date(m.created_at) <= toDate);
    }

    if (messagesFilters.searchQuery.trim()) {
      const q = messagesFilters.searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          (m.subject || '').toLowerCase().includes(q) ||
          (m.body_text || '').toLowerCase().includes(q) ||
          (m.sender_email || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aDate = new Date(a.created_at || 0);
      const bDate = new Date(b.created_at || 0);
      return messagesFilters.sortBy === 'newest' ? bDate - aDate : aDate - bDate;
    });

    return result;
  }, [messages, messagesFilters]);

  const contactsActiveCount = useMemo(() => {
    let count = 0;
    if (filter && filter !== 'all') count += 1;
    if (searchQuery?.trim()) count += 1;
    return count;
  }, [filter, searchQuery]);

  const messagesActiveCount = useMemo(() => {
    let count = 0;
    if (messagesFilters.status !== 'all') count += 1;
    if (messagesFilters.from) count += 1;
    if (messagesFilters.to) count += 1;
    if (messagesFilters.searchQuery.trim()) count += 1;
    if (messagesFilters.sortBy !== 'newest') count += 1;
    if (messagesFilters.showLogs) count += 1;
    return count;
  }, [messagesFilters]);

  const handleUpdateMessagesFilters = (patch) => {
    setMessagesFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleClearContactsFilters = () => {
    setFilter(DEFAULT_CONTACTS_FILTERS.filter);
    setSearchQuery(DEFAULT_CONTACTS_FILTERS.searchQuery);
  };

  const handleClearMessagesFilters = () => {
    setMessagesFilters(DEFAULT_MESSAGES_FILTERS);
  };

  const sidebarFilters = (
    <B2BFilterSidebar
      activeCount={activeTab === 'contacts' ? contactsActiveCount : messagesActiveCount}
      isCollapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebarCollapsed}
      onClearAll={activeTab === 'contacts' ? handleClearContactsFilters : handleClearMessagesFilters}
    >
      {activeTab === 'contacts' ? (
        <B2BContactsSidebarFilters
          filter={filter}
          searchQuery={searchQuery}
          onFilterChange={setFilter}
          onSearchChange={setSearchQuery}
          onClearAll={handleClearContactsFilters}
        />
      ) : (
        <B2BMessagesSidebarFilters
          filters={messagesFilters}
          hasDraftMessages={hasDraftMessages}
          onChange={handleUpdateMessagesFilters}
          onClearAll={handleClearMessagesFilters}
        />
      )}
    </B2BFilterSidebar>
  );

  const topBar = (
    <div className="b2b-top-bar-inner">
      <div className="b2b-tabs" role="tablist" aria-label="B2B Mail sections">
        <button
          type="button"
          className={`b2b-tab ${activeTab === 'contacts' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('contacts')}
          role="tab"
          aria-selected={activeTab === 'contacts'}
          title="Contacts"
        >
          <span className="b2b-tab-icon" aria-hidden="true">▦</span>
          <span className="b2b-tab-label">Contacts</span>
        </button>
        <button
          type="button"
          className={`b2b-tab ${activeTab === 'messages' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('messages')}
          role="tab"
          aria-selected={activeTab === 'messages'}
          title="Messages"
        >
          <span className="b2b-tab-icon" aria-hidden="true">⇣</span>
          <span className="b2b-tab-label">Messages</span>
        </button>
        <button
          type="button"
          className="b2b-filter-inline-btn"
          onClick={() => setFilterDrawerOpen(true)}
          aria-label="Open filters"
          title="Filters"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path
              d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {(activeTab === 'contacts' ? contactsActiveCount : messagesActiveCount) > 0 && (
            <span className="b2b-filter-inline-badge">
              {activeTab === 'contacts' ? contactsActiveCount : messagesActiveCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout activePage="b2b-mail">
      <div className="admin-page-container b2b-mail-page-container">
        {/* Header */}
        <header className="dashboard-header-flex b2b-header">
          <div className="header-content">
            <h2 className="header-title">B2B Mail</h2>
            <p className="header-subtitle">
              Manage partner contacts and send feeder communications to LGU/DILG.
            </p>
          </div>
          <div className="b2b-header-actions">
            <button
              type="button"
              className="btn-new-advisory btn btn-primary"
              onClick={openCompose}
              disabled={saving}
            >
              + New Message
            </button>
          </div>
        </header>

        <B2BDualPaneLayout
          topBar={topBar}
          leftPane={sidebarFilters}
          leftPaneCollapsed={sidebarCollapsed}
          rightPane={
            <div className="main-content-card b2b-content">
              {activeTab === 'contacts' ? (
                <>
                  <div className="b2b-contacts-top-actions">
                    <button
                      type="button"
                      className="btn-new-advisory btn btn-primary b2b-new-contact-btn-normal"
                      onClick={openNewContact}
                      disabled={saving}
                    >
                      + New Contact
                    </button>
                  </div>
                <div className="b2b-contacts-pool">
                  <div className="b2b-contacts-header">
                    <div className="b2b-contacts-stats">
                      <div className="b2b-contacts-stat total">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                      </div>
                      <div className="b2b-contacts-stat verified">
                        <span className="stat-value">{stats.verified}</span>
                        <span className="stat-label">Verified</span>
                      </div>
                      <div className="b2b-contacts-stat unverified">
                        <span className="stat-value">{stats.unverified}</span>
                        <span className="stat-label">Unverified</span>
                      </div>
                      <div className="b2b-contacts-stat active">
                        <span className="stat-value">{stats.active}</span>
                        <span className="stat-label">Active</span>
                      </div>
                      <div className="b2b-contacts-stat inactive">
                        <span className="stat-value">{stats.inactive}</span>
                        <span className="stat-label">Inactive</span>
                      </div>
                    </div>
                  </div>
                  <B2BBulkActionBar
                    selectedCount={selectedIds.length}
                    onClearSelection={() => setSelectedIds([])}
                    onSendVerification={handleBulkSendVerification}
                    onDelete={handleBulkDelete}
                    onToggleActive={handleBulkToggleActive}
                    saving={saving}
                  />
                  <B2BContactList
                    contacts={contacts}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onEdit={openEditContact}
                    onSendVerification={sendVerification}
                    onToggleActive={setContactActive}
                    loading={contactsLoading}
                  />
                </div>
                </>
              ) : (
                <B2BMessagesView
                  messages={filteredMessages}
                  allMessages={messages}
                  loading={messagesLoading}
                  onRefresh={loadMessages}
                  onViewDetails={() => {}}
                  showLogs={messagesFilters.showLogs}
                  stats={messagesStats}
                  hasDraftMessages={hasDraftMessages}
                />
              )}
            </div>
          }
        />

        <B2BFilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
        >
          {activeTab === 'contacts' ? (
            <B2BContactsSidebarFilters
              filter={filter}
              searchQuery={searchQuery}
              onFilterChange={setFilter}
              onSearchChange={setSearchQuery}
              onClearAll={handleClearContactsFilters}
            />
          ) : (
            <B2BMessagesSidebarFilters
              filters={messagesFilters}
              hasDraftMessages={hasDraftMessages}
              onChange={handleUpdateMessagesFilters}
              onClearAll={handleClearMessagesFilters}
            />
          )}
        </B2BFilterDrawer>
        {/* Contact Form Modal */}
        <B2BContactForm
          isOpen={isContactModalOpen}
          onClose={closeContactModal}
          contact={editingContact}
          feederOptions={feederOptions}
          onSave={upsertContact}
          saving={saving}
        />
        {/* Compose Message Modal */}
        <B2BMessageCompose
          isOpen={isComposeOpen}
          onClose={closeCompose}
          onSend={handleSendMessage}
          onSaveDraft={handleSaveDraft}
          onPreviewRecipients={previewRecipients}
          previewResult={previewResult}
          contacts={allContacts}
          feederOptions={feederOptions}
          templates={templates}
          saving={saving}
        />
      </div>
    </AdminLayout>
  );
};

export default B2BMail;