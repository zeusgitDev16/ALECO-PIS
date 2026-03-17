import { useState, useEffect } from 'react';
// Adjust this import path if your axiosConfig.js is located differently relative to this file
import axios from '../api/axiosConfig'; 

const useTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 1. The Master Filter State (CLEANED: Removed barangay & purok)
    const [filters, setFilters] = useState({
        tab: 'Open',
        isNew: false,
        isUrgent: false,
        status: '',
        searchQuery: '',
        category: '',
        district: '',
        municipality: '',
        datePreset: '',
        startDate: '',
        endDate: '',
        groupFilter: 'all' // 'all' | 'grouped' | 'ungrouped'
    });

    // 2. The Fetch Logic (shared for initial load and refetch)
    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            Object.keys(filters).forEach(key => {
                const value = filters[key];
                if (value !== '' && value !== false) {
                    params[key] = value;
                }
            });

            const response = await axios.get('/api/filtered-tickets', { params });

            if (response.data.success) {
                setTickets(response.data.data);
            } else {
                setError("No tickets found matching your filters.");
            }
        } catch (err) {
            console.error("❌ Failed to fetch tickets:", err);
            setError("Could not load tickets. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [filters]);

    const refetch = () => fetchTickets();

    return { tickets, loading, error, filters, setFilters, refetch };
};

export default useTickets;
