import { useState, useEffect, useCallback } from 'react';
import {
  listInterruptions,
  createInterruption,
  updateInterruption,
  deleteInterruption,
  restoreInterruption,
  permanentlyDeleteInterruption,
  pullFromFeed,
  pushToFeed,
  getInterruption,
  addInterruptionUpdate,
} from '../api/interruptionsApi.js';

const ADMIN_LIMIT = 200;

/** @typedef {'active' | 'all' | 'archived'} ListArchiveFilter */

function archiveFilterToQuery(filter) {
  if (filter === 'all') return { includeDeleted: true, deletedOnly: false };
  if (filter === 'archived') return { includeDeleted: true, deletedOnly: true };
  return { includeDeleted: false, deletedOnly: false };
}

/**
 * Admin power advisories: list load with error surface, CRUD helpers.
 */
export function useAdminInterruptions() {
  const [interruptions, setInterruptions] = useState([]);
  const [listArchiveFilter, setListArchiveFilter] = useState(
    /** @type {ListArchiveFilter} */ ('active')
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [editDetail, setEditDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoMessage, setMemoMessage] = useState(null);

  const listQuery = archiveFilterToQuery(listArchiveFilter);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const r = await listInterruptions({
      limit: ADMIN_LIMIT,
      includeFuture: true,
      includeDeleted: listQuery.includeDeleted,
      deletedOnly: listQuery.deletedOnly,
    });
    setLoading(false);
    if (r.success && !r.unavailable) {
      setInterruptions(r.data);
      setFetchError(null);
    } else {
      setInterruptions([]);
      setFetchError(r.message || 'Could not load advisories. Check the API server and try Refresh list.');
    }
  }, [listQuery.includeDeleted, listQuery.deletedOnly]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchList();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchList]);

  const loadEditDetail = useCallback(async (id) => {
    if (id == null) {
      setEditDetail(null);
      return;
    }
    setDetailLoading(true);
    setMemoMessage(null);
    const r = await getInterruption(id);
    setDetailLoading(false);
    if (r.success && r.data) {
      setEditDetail(r.data);
    } else {
      setEditDetail(null);
      setMessage({ type: 'err', text: r.message || 'Could not load advisory detail.' });
    }
  }, []);

  const clearEditDetail = useCallback(() => {
    setEditDetail(null);
    setDetailLoading(false);
    setMemoMessage(null);
  }, []);

  /**
   * @param {number} id
   * @param {string} remark
   * @returns {Promise<boolean>}
   */
  const addMemo = useCallback(async (id, remark) => {
    setMemoSaving(true);
    setMemoMessage(null);
    try {
      const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
      const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
      const body = { remark };
      if (userEmail) body.actorEmail = userEmail;
      if (userName) body.actorName = userName;
      const r = await addInterruptionUpdate(id, body);
      if (r.success && r.data?.updates) {
        setEditDetail((prev) => (prev && prev.id === id ? { ...prev, updates: r.data.updates } : prev));
        setMemoMessage({ type: 'ok', text: 'Remark added.' });
        return true;
      }
      setMemoMessage({ type: 'err', text: r.message || 'Failed to add remark.' });
      return false;
    } catch {
      setMemoMessage({ type: 'err', text: 'Network error.' });
      return false;
    } finally {
      setMemoSaving(false);
    }
  }, []);

  /**
   * @param {{ editingId: number|null, payload: object }} args
   * @returns {Promise<{ saved: boolean, conflict?: boolean }>}
   */
  const saveAdvisory = useCallback(
    async ({ editingId, payload }) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = editingId
          ? await updateInterruption(editingId, payload)
          : await createInterruption(payload);
        if (r.status === 409) {
          setMessage({
            type: 'conflict',
            text:
              r.message ||
              'This advisory was updated elsewhere. Reload the latest version before saving again.',
          });
          return { saved: false, conflict: true };
        }
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Save failed.' });
          return { saved: false };
        }
        const okText = editingId ? 'Saved.' : 'Published.';
        setMessage({ type: 'ok', text: okText });
        await fetchList();
        if (editingId) {
          await loadEditDetail(editingId);
        }
        return { saved: true };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { saved: false };
      } finally {
        setSaving(false);
      }
    },
    [fetchList, loadEditDetail]
  );

  const removeAdvisory = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await deleteInterruption(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Archive failed.' });
          return false;
        }
        setMessage({
          type: 'ok',
          text: 'Archived. Hidden from the public bulletin; row and remarks are kept for reporting.',
        });
        await fetchList();
        return true;
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  const restoreAdvisory = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await restoreInterruption(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Restore failed.' });
          return false;
        }
        setMessage({ type: 'ok', text: 'Advisory unarchived.' });
        await fetchList();
        return true;
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  const permanentDeleteAdvisory = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await permanentlyDeleteInterruption(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Permanent delete failed.' });
          return false;
        }
        setMessage({ type: 'ok', text: 'Permanently deleted.' });
        await fetchList();
        return true;
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  const pullFromFeedAdvisory = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await pullFromFeed(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Pull from feed failed.' });
          return false;
        }
        setMessage({ type: 'ok', text: 'Advisory pulled from public feed.' });
        await fetchList();
        return true;
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  const pushToFeedAdvisory = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await pushToFeed(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Push to feed failed.' });
          return false;
        }
        setMessage({ type: 'ok', text: 'Advisory pushed back to public feed.' });
        await fetchList();
        return true;
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  return {
    interruptions,
    loading,
    saving,
    message,
    setMessage,
    fetchError,
    fetchList,
    listArchiveFilter,
    setListArchiveFilter,
    saveAdvisory,
    removeAdvisory,
    restoreAdvisory,
    permanentDeleteAdvisory,
    pullFromFeedAdvisory,
    pushToFeedAdvisory,
    editDetail,
    detailLoading,
    memoSaving,
    memoMessage,
    setMemoMessage,
    loadEditDetail,
    clearEditDetail,
    addMemo,
  };
}
