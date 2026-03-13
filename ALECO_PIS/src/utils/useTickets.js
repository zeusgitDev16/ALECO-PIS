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
        searchQuery: '',
        category: '',
        district: '',
        municipality: '',
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
                // Build clean params object (only non-empty values)
                const params = {};
                Object.keys(filters).forEach(key => {
                    const value = filters[key];
                    if (value !== '' && value !== false) {
                        params[key] = value;
                    }
                });

                console.log('🔍 Sending Filter Params:', params);

                const response = await axios.get('/api/filtered-tickets', { params });

                if (response.data.success) {
                    console.log(`✅ Received ${response.data.data.length} tickets`);
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

        fetchTickets();
    }, [filters]);

    return { tickets, loading, error, filters, setFilters };
};

export default useTickets;
