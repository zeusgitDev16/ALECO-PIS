import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listB2BMessages,
  saveB2BDraft,
  sendB2BMessage,
  previewB2BRecipientsBody,
  listB2BTemplates,
} from '../api/b2bMailApi';

/**
 * Hook for managing B2B message composition and sending
 */
export function useB2BMessages() {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  
  // Folder filter
  const [folder, setFolder] = useState('all');

  // Load messages
  const loadMessages = useCallback(async () => {
    setLoading(true);
    const r = await listB2BMessages({ folder });
    if (r.success && Array.isArray(r.data)) {
      setMessages(r.data);
    } else {
      setMessages([]);
    }
    setLoading(false);
  }, [folder]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    const r = await listB2BTemplates();
    if (r.success && Array.isArray(r.data)) {
      setTemplates(r.data);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadMessages();
    loadTemplates();
  }, [loadMessages, loadTemplates]);

  // Compose and send
  const saveDraft = useCallback(async (formData) => {
    setSaving(true);
    const payload = {
      targetMode: formData.targetMode,
      selectedFeederIds: formData.selectedFeederIds,
      selectedContactIds: formData.selectedContactIds,
      interruptionId: formData.interruptionId || null,
      templateId: formData.templateId || null,
      subject: formData.subject,
      bodyText: formData.bodyText,
      bodyHtml: null,
    };
    
    const r = await saveB2BDraft(payload);
    if (r.success) {
      setMessage({ type: 'ok', text: 'Draft saved' });
      await loadMessages();
    } else {
      setMessage({ type: 'err', text: r.message || 'Failed to save draft' });
    }
    setSaving(false);
    return r;
  }, [loadMessages]);

  const sendMessage = useCallback(async (formData) => {
    setSaving(true);
    
    // First save as draft
    const draftPayload = {
      targetMode: formData.targetMode,
      selectedFeederIds: formData.selectedFeederIds,
      selectedContactIds: formData.selectedContactIds,
      interruptionId: formData.interruptionId || null,
      templateId: formData.templateId || null,
      subject: formData.subject,
      bodyText: formData.bodyText,
      bodyHtml: null,
    };
    
    const draftR = await saveB2BDraft(draftPayload);
    if (!draftR.success || !draftR.data?.id) {
      setMessage({ type: 'err', text: draftR.message || 'Failed to save draft' });
      setSaving(false);
      return draftR;
    }
    
    // Then send
    const sendR = await sendB2BMessage(draftR.data.id);
    if (sendR.success) {
      setMessage({ type: 'ok', text: 'Message sent successfully' });
      await loadMessages();
    } else {
      setMessage({ type: 'err', text: sendR.message || 'Failed to send message' });
    }
    
    setSaving(false);
    return sendR;
  }, [loadMessages]);

  const previewRecipients = useCallback(async (formData) => {
    const payload = {
      targetMode: formData.targetMode,
      selectedFeederIds: formData.selectedFeederIds,
      selectedContactIds: formData.selectedContactIds,
      interruptionId: formData.interruptionId || null,
    };
    
    const r = await previewB2BRecipientsBody(payload);
    if (r.success && r.data) {
      setPreviewResult(r.data);
    } else {
      setPreviewResult(null);
      setMessage({ type: 'err', text: r.message || 'Failed to preview recipients' });
    }
    return r;
  }, []);

  const clearPreview = useCallback(() => setPreviewResult(null), []);
  const clearMessage = useCallback(() => setMessage(null), []);

  return {
    messages,
    templates,
    loading,
    saving,
    message,
    clearMessage,
    previewResult,
    clearPreview,
    // Filter
    folder,
    setFolder,
    // Operations
    loadMessages,
    saveDraft,
    sendMessage,
    previewRecipients,
  };
}
