import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'aleco_recent_opened_tickets';
const MAX_ENTRIES = 50;

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
 * Persists to localStorage so it survives refresh.
 * @returns {{ addOpened: (ticketId: string) => void, recentIds: string[], timeRange: string, setTimeRange: (v: string) => void }}
 */
const COLLAPSED_KEY = 'aleco_recent_opened_collapsed';

export const useRecentOpenedTickets = () => {
    const [entries, setEntries] = useState([]);
    const [timeRange, setTimeRange] = useState('1'); // '0.25' | '1' | '7' | '24'
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem(COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        setEntries(getStored());
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
        } catch {}
    }, [isCollapsed]);

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
