import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import AdminLayout from './AdminLayout';
import { useB2BContacts } from '../hooks/useB2BContacts';
import { useB2BMessages } from '../hooks/useB2BMessages';
import { apiUrl } from '../utils/api';
import { FEEDER_AREAS } from '../config/feederConfig';
import B2BContactFilters from './b2bmail/B2BContactFilters';
import B2BContactList from './b2bmail/B2BContactList';
import B2BBulkActionBar from './b2bmail/B2BBulkActionBar';
import B2BContactForm from './b2bmail/B2BContactForm';
import B2BMessageCompose from './b2bmail/B2BMessageCompose';
import '../CSS/AdminPageLayout.css';
import '../CSS/B2BMailPage.css';
import '../CSS/B2BMailUIScale.css';

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
  } = useB2BMessages();

  // Local state
  const [feeders, setFeeders] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts');

  // Load feeders with fallback to config
  useEffect(() => {
    const loadFeeders = async () => {
      try {
        const res = await fetch(apiUrl('/api/feeders'));
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
        const res = await fetch(apiUrl(`/api/b2b-mail/contacts/${id}`), {
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

  // Stats display
  const StatCard = ({ label, value, active, onClick }) => (
    <button
      type="button"
      className={`b2b-stat-card ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <span className="b2b-stat-value">{value}</span>
      <span className="b2b-stat-label">{label}</span>
    </button>
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

        {/* Tab Navigation */}
        <div className="b2b-tabs nav nav-tabs">
          <button
            type="button"
            className={`nav-link ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Messages
          </button>
        </div>

        {/* Stats Row */}
        {activeTab === 'contacts' && (
          <div className="b2b-stats-row">
            <StatCard
              label="Total"
              value={stats.total}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <StatCard
              label="Verified"
              value={stats.verified}
              active={filter === 'verified'}
              onClick={() => setFilter('verified')}
            />
            <StatCard
              label="Unverified"
              value={stats.unverified}
              active={filter === 'unverified'}
              onClick={() => setFilter('unverified')}
            />
            <StatCard
              label="Active"
              value={stats.active}
              active={filter === 'active'}
              onClick={() => setFilter('active')}
            />
            <StatCard
              label="Inactive"
              value={stats.inactive}
              active={filter === 'inactive'}
              onClick={() => setFilter('inactive')}
            />
          </div>
        )}
        {/* Content */}
        <div className="main-content-card b2b-content">
          {activeTab === 'contacts' ? (
            <>
              {/* Contacts View */}
              <div className="b2b-toolbar">
                <B2BContactFilters
                  activeFilter={filter}
                  onFilterChange={setFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openNewContact}
                  disabled={saving}
                >
                  + New Contact
                </button>
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
            </>
          ) : (
            <>
              {/* Messages View - Simplified for now */}
              <div className="b2b-messages-view">
                <p className="b2b-placeholder">
                  Messages view coming soon. Use "New Message" button to compose.
                </p>
                {messages.length > 0 && (
                  <div className="b2b-messages-list">
                    {messages.slice(0, 10).map((m) => (
                      <div key={m.id} className="b2b-message-item">
                        <span className="b2b-message-subject">
                          {m.subject || '(No subject)'}
                        </span>
                        <span
                          className={`b2b-status-badge b2b-status-${m.status}`}
                        >
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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