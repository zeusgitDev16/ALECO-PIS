import { useState, useEffect } from 'react';
// Adjust this import path if your axiosConfig.js is located differently relative to this file
import axios from '../api/axiosConfig'; 

const useTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 1. The Master Filter State
    // We set the default tab to 'Open' so the dashboard loads unresolved tickets first
    const [filters, setFilters] = useState({
        tab: 'Open', 
        isNew: false,
        searchQuery: '',
        category: '',
        district: '',
        municipality: '',
        barangay: '',
        purok: '',
        datePreset: '',
        startDate: '',
        endDate: ''
    });

    // 2. The Fetch Logic
    useEffect(() => {
    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            Object.keys(filters).forEach(key => {
                if (filters[key] !== '' && filters[key] !== false) {
                    params[key] = filters[key];
                }
            });

            // CORRECT: Uses '/api/filtered-tickets' (no double /api prefix)
            const response = await axios.get('/api/filtered-tickets', { params });

            if (response.data.success) {
                setTickets(response.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch tickets:", err);
            setError("Could not load tickets. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    fetchTickets();
}, [filters]);

    return { tickets, loading, error, filters, setFilters };
};

export default useTickets;