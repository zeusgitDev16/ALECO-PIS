import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createB2BContact,
  listB2BContacts,
  sendB2BContactVerification,
  toggleB2BContactActive,
  updateB2BContact,
} from '../api/b2bMailApi';

/**
 * Hook for managing B2B contacts with filtering and bulk operations
 */
export function useB2BContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Filter states
  const [filter, setFilter] = useState('all'); // all, verified, unverified, active, inactive
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState([]);

  // Load contacts
  const loadContacts = useCallback(async () => {
    setLoading(true);
    const r = await listB2BContacts({ q: searchQuery });
    if (r.success && Array.isArray(r.data)) {
      setContacts(r.data);
    } else {
      setContacts([]);
      setMessage({ type: 'err', text: r.message || 'Failed to load contacts' });
    }
    setLoading(false);
  }, [searchQuery]);

  // Initial load and refresh on filter/search change
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    
    // Apply status filter
    switch (filter) {
      case 'verified':
        result = result.filter((c) => c.email_verified === 1 || c.email_verified === true);
        break;
      case 'unverified':
        result = result.filter((c) => c.email_verified !== 1 && c.email_verified !== true);
        break;
      case 'active':
        result = result.filter((c) => c.is_active === 1 || c.is_active === true);
        break;
      case 'inactive':
        result = result.filter((c) => c.is_active !== 1 && c.is_active !== true);
        break;
      default:
        break;
    }
    
    return result;
  }, [contacts, filter]);

  // Statistics
  const stats = useMemo(() => ({
    total: contacts.length,
    verified: contacts.filter((c) => c.email_verified === 1 || c.email_verified === true).length,
    unverified: contacts.filter((c) => c.email_verified !== 1 && c.email_verified !== true).length,
    active: contacts.filter((c) => c.is_active === 1 || c.is_active === true).length,
    inactive: contacts.filter((c) => c.is_active !== 1 && c.is_active !== true).length,
  }), [contacts]);

  // CRUD Operations
  const createContact = useCallback(async (data) => {
    setSaving(true);
    const r = await createB2BContact(data);
    if (r.success) {
      setMessage({ type: 'ok', text: 'Contact created successfully' });
      await loadContacts();
    } else {
      setMessage({ type: 'err', text: r.message || 'Failed to create contact' });
    }
    setSaving(false);
    return r;
  }, [loadContacts]);

  const updateContact = useCallback(async (data) => {
    setSaving(true);
    const r = await updateB2BContact(data.id, data);
    if (r.success) {
      setMessage({ type: 'ok', text: 'Contact updated successfully' });
      await loadContacts();
    } else {
      setMessage({ type: 'err', text: r.message || 'Failed to update contact' });
    }
    setSaving(false);
    return r;
  }, [loadContacts]);

  const upsertContact = useCallback(async (data) => {
    if (data.id) {
      return updateContact(data);
    }
    return createContact(data);
  }, [createContact, updateContact]);

  const setContactActive = useCallback(async (id, active) => {
    setSaving(true);
    const r = await toggleB2BContactActive(id, active);
    if (r.success) {
      setMessage({ type: 'ok', text: `Contact ${active ? 'enabled' : 'disabled'}` });
      await loadContacts();
    } else {
      setMessage({ type: 'err', text: r.message || 'Failed to update contact' });
    }
    setSaving(false);
    return r;
  }, [loadContacts]);

  const sendVerification = useCallback(async (id) => {
    setSaving(true);
    const r = await sendB2BContactVerification(id);
    if (r.success) {
      setMessage({ type: 'ok', text: 'Verification email sent' });
      await loadContacts();
    } else {
      setMessage({ type: 'err', text: r.message || 'Failed to send verification' });
    }
    setSaving(false);
    return r;
  }, [loadContacts]);

  // Bulk Operations
  const bulkSendVerification = useCallback(async (ids) => {
    setSaving(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      const r = await sendB2BContactVerification(id);
      if (r.success) successCount++;
      else failCount++;
    }
    
    setMessage({
      type: failCount === 0 ? 'ok' : 'err',
      text: `Sent ${successCount} verification(s)${failCount > 0 ? `, ${failCount} failed` : ''}`
    });
    
    await loadContacts();
    setSaving(false);
  }, [loadContacts]);

  const bulkToggleActive = useCallback(async (ids) => {
    setSaving(true);
    // Get current states
    const contactsToToggle = contacts.filter((c) => ids.includes(Number(c.id)));
    const allActive = contactsToToggle.every((c) => c.is_active === 1 || c.is_active === true);
    const newState = !allActive; // If all active, deactivate; otherwise activate
    
    let successCount = 0;
    for (const id of ids) {
      const r = await toggleB2BContactActive(id, newState);
      if (r.success) successCount++;
    }
    
    setMessage({
      type: 'ok',
      text: `Updated ${successCount} contact(s) to ${newState ? 'active' : 'inactive'}`
    });
    
    await loadContacts();
    setSaving(false);
  }, [contacts, loadContacts]);

  const clearMessage = useCallback(() => setMessage(null), []);

  return {
    contacts: filteredContacts,
    allContacts: contacts,
    loading,
    saving,
    message,
    clearMessage,
    stats,
    // Filter
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    // Selection
    selectedIds,
    setSelectedIds,
    // Operations
    loadContacts,
    upsertContact,
    setContactActive,
    sendVerification,
    bulkSendVerification,
    bulkToggleActive,
  };
}
