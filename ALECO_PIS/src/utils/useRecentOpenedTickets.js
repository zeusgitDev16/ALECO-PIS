import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RECENT_OPENED_TICKETS_KEY as STORAGE_KEY,
    RECENT_OPENED_TICKETS_TIME_RANGE_KEY as TIME_RANGE_KEY,
    RECENT_OPENED_TICKETS_COLLAPSED_KEY as COLLAPSED_KEY,
} from './recentOpenedStorageKeys';

const MAX_ENTRIES = 50;
const TIME_RANGE_VALUES = new Set(['0.25', '1', '7', '24']);

const parseTimeRange = (raw) => {
    const s = raw == null ? '' : String(raw);
    return TIME_RANGE_VALUES.has(s) ? s : '1';
};

/**
 * Get recent opened tickets from localStorage
 * @returns {Array<{ticket_id: string, opened_at: string}>}
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
        console.warn('Failed to save recent opened tickets:', e);
    }
};

/**
 * useRecentOpenedTickets - Tracks tickets the user has opened (viewed in detail pane)
 * Persists to localStorage so it survives refresh, navigation, and logout (prefs preserved).
 * @returns {{ addOpened: (ticketId: string) => void, recentIds: string[], timeRange: string, setTimeRange: (v: string) => void }}
 */
export const useRecentOpenedTickets = () => {
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

    const addOpened = useCallback((ticketId) => {
        if (!ticketId) return;
        const now = new Date().toISOString();
        setEntries(prev => {
            const filtered = prev.filter(e => e.ticket_id !== ticketId);
            const next = [{ ticket_id: ticketId, opened_at: now }, ...filtered];
            setStored(next);
            return next;
        });
    }, []);

    const hours = parseFloat(timeRange) || 1;
    const recentIds = useMemo(() => {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return entries
            .filter(e => new Date(e.opened_at).getTime() >= cutoff)
            .map(e => e.ticket_id);
    }, [entries, hours]);

    return { addOpened, recentIds, timeRange, setTimeRange, isCollapsed, setIsCollapsed };
};
