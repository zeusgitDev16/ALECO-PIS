import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RECENT_OPENED_ADVISORIES_KEY as STORAGE_KEY,
    RECENT_OPENED_ADVISORIES_TIME_RANGE_KEY as TIME_RANGE_KEY,
    RECENT_OPENED_ADVISORIES_COLLAPSED_KEY as COLLAPSED_KEY,
} from './recentOpenedStorageKeys';

const MAX_ENTRIES = 50;
const TIME_RANGE_VALUES = new Set(['0.25', '1', '7', '24']);

const parseTimeRange = (raw) => {
    const s = raw == null ? '' : String(raw);
    return TIME_RANGE_VALUES.has(s) ? s : '1';
};

/**
 * Get recent opened advisories from localStorage
 * @returns {Array<{id: number, opened_at: string}>}
 */
const getStored = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

/**
 * Save to localStorage
 * @param {Array} entries
 */
const setStored = (entries) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    } catch (e) {
        console.warn('Failed to save recent opened advisories:', e);
    }
};

/**
 * useRecentOpenedAdvisories - Tracks advisories the user has opened (viewed in modal)
 * Persists to localStorage so it survives refresh, navigation, and logout (prefs preserved).
 * @returns {{ addOpened: (id: number) => void, recentIds: number[], timeRange: string, setTimeRange: (v: string) => void, isCollapsed: boolean, setIsCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void }}
 */
export const useRecentOpenedAdvisories = () => {
    const [entries, setEntries] = useState([]);
    const [timeRange, setTimeRangeState] = useState(() => {
        try {
            return parseTimeRange(localStorage.getItem(TIME_RANGE_KEY));
        } catch {
            return '1';
        }
    });
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            const stored = localStorage.getItem(COLLAPSED_KEY);
            return stored !== null ? stored === 'true' : true; /* Default collapsed to preserve space */
        } catch {
            return true;
        }
    });

    useEffect(() => {
        setEntries(getStored());
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(TIME_RANGE_KEY, timeRange);
        } catch {
            /* ignore */
        }
    }, [timeRange]);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
        } catch {}
    }, [isCollapsed]);

    const setTimeRange = useCallback((v) => {
        setTimeRangeState(parseTimeRange(v));
    }, []);

    const addOpened = useCallback((id) => {
        if (id == null || id === '') return;
        const numId = typeof id === 'number' ? id : parseInt(id, 10);
        if (Number.isNaN(numId)) return;
        const now = new Date().toISOString();
        setEntries(prev => {
            const filtered = prev.filter(e => e.id !== numId);
            const next = [{ id: numId, opened_at: now }, ...filtered];
            setStored(next);
            return next;
        });
    }, []);

    const hours = parseFloat(timeRange) || 1;
    const recentIds = useMemo(() => {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return entries
            .filter(e => new Date(e.opened_at).getTime() >= cutoff)
            .map(e => e.id);
    }, [entries, hours]);

    return { addOpened, recentIds, timeRange, setTimeRange, isCollapsed, setIsCollapsed };
};
