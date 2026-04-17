import { useState, useEffect, useCallback } from 'react';
import {
  listServiceMemos,
  updateServiceMemo,
  closeServiceMemo,
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
      status: filters.status,
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
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchList();
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
    async (id, body) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await updateServiceMemo(id, body);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Update failed.' });
          return { saved: false };
        }
        setMessage({ type: 'ok', text: 'Saved.' });
        await fetchList();
        return { saved: true };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { saved: false };
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
    async (id) => {
      setSaving(true);
      setMessage(null);
      try {
        const r = await closeServiceMemo(id);
        if (!r.success) {
          setMessage({ type: 'err', text: r.message || 'Close failed.' });
          return { closed: false };
        }
        setMessage({ type: 'ok', text: 'Service memo closed.' });
        await fetchList();
        return { closed: true };
      } catch {
        setMessage({ type: 'err', text: 'Network error.' });
        return { closed: false };
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
  };
}
