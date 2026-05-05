import { useState, useEffect, useCallback } from 'react';
import {
  listServiceMemos,
  updateServiceMemo,
  closeServiceMemo,
  deleteServiceMemo,
} from '../api/serviceMemosApi.js';

/**
 * Admin service memos: list load with error surface, CRUD helpers.
 */
export function useServiceMemos() {
  const [memos, setMemos] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    searchAccount: '',
    searchName: '',
    searchAddress: '',
    searchMemo: '',
    status: '',
    municipality: '',
    startDate: '',
    endDate: '',
    owner: '',
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const r = await listServiceMemos({
      tab: activeTab,
      search: filters.search,
      searchMemo: filters.searchMemo,
      searchAccount: filters.searchAccount,
      searchCustomer: filters.searchName,
      searchAddress: filters.searchAddress,
      status: filters.status,
      municipality: filters.municipality,
      startDate: filters.startDate,
      endDate: filters.endDate,
      owner: filters.owner,
    });
    setLoading(false);
    if (r.success) {
      setMemos(r.data);
      setFetchError(null);
    } else {
      setMemos([]);
      setFetchError(r.message || 'Could not load service memos. Check the API server and try Refresh list.');
    }
  }, [activeTab, filters]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    // Only refetch when the user truly returns to the tab after being away.
    // A brief visibility change (e.g. print dialog, file picker, alert) must
    // NOT trigger a refetch — that wipes the list under a loading spinner and
    // forces the user to manually refresh. Threshold: 30 seconds hidden.
    let hiddenAt = null;
    const HIDDEN_REFETCH_THRESHOLD_MS = 30_000;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        const wasHiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = null;
        if (wasHiddenFor > HIDDEN_REFETCH_THRESHOLD_MS) fetchList();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchList]);

  /**
   * @param {number} id
   * @param {object} body
   * @returns {Promise<{ saved: boolean }>}
   */
  const updateMemo = useCallback(
    async (id, body, expectedUpdatedAt = null) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await updateServiceMemo(id, body, expectedUpdatedAt);
        if (r.conflict) {
          setMessage({ type: 'err', text: 'This memo was updated by someone else. Reloading latest data.' });
          await fetchList();
          return { saved: false, conflict: true };
        }
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Update failed.' });
          return { saved: false, conflict: false };
        }
        setMessage({ type: 'ok', text: 'Saved.' });
        await fetchList();
        return { saved: true, conflict: false };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { saved: false, conflict: false };
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  /**
   * @param {number} id
   * @returns {Promise<{ closed: boolean }>}
   */
  const closeMemo = useCallback(
    async (id, expectedUpdatedAt = null) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await closeServiceMemo(id, expectedUpdatedAt);
        if (r.conflict) {
          setMessage({ type: 'err', text: 'This memo was updated by someone else. Reloading latest data.' });
          await fetchList();
          return { closed: false, conflict: true };
        }
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Close failed.' });
          return { closed: false, conflict: false };
        }
        setMessage({ type: 'ok', text: 'Service memo closed.' });
        await fetchList();
        return { closed: true, conflict: false };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { closed: false, conflict: false };
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  /**
   * @param {number} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  const deleteMemo = useCallback(
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await deleteServiceMemo(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Delete failed.' });
          return { deleted: false };
        }
        setMessage({ type: 'ok', text: 'Service memo deleted.' });
        window.dispatchEvent(new Event('service-memo-deleted'));
        await fetchList();
        return { deleted: true };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { deleted: false };
      } finally {
        setSaving(false);
      }
    },
    [fetchList]
  );

  return {
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
    deleteMemo,
  };
}
