import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// IDEMPOTENT FILTER ROUTE: Returns tickets based on admin dashboard filters
router.get('/filtered-tickets', async (req, res) => {
    try {
        const { 
            tab, isNew, searchQuery, category, district, 
            municipality, datePreset, startDate, endDate
        } = req.query;

        let query = `SELECT * FROM aleco_tickets WHERE 1=1`;
        const params = [];

        // --- Status Tabs ---
        if (tab === 'Open') {
            query += ` AND (status IN ('Pending', 'Ongoing') OR status IS NULL OR status = '')`;
        } else if (tab === 'Closed') {
            query += ` AND status = 'Restored'`;
        }

        // --- 48 Hour Toggle ---
        if (isNew === 'true') {
            query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`;
        }

        // --- Search Bar ---
        if (searchQuery) {
            query += ` AND (ticket_id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR concern LIKE ?)`;
            const searchWildcard = `%${searchQuery}%`;
            params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
        }

        // --- Category & Locations ---
        if (category) { query += ` AND category = ?`; params.push(category); }
        if (district) { query += ` AND district = ?`; params.push(district); }
        if (municipality) { query += ` AND municipality = ?`; params.push(municipality); }

        // --- Date Filters ---
        if (datePreset) {
            if (datePreset === 'today') {
                query += ` AND DATE(created_at) = CURDATE()`;
            } else if (datePreset === 'week') {
                query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (datePreset === 'month') {
                query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            }
        }

        if (startDate && endDate) {
            query += ` AND DATE(created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY created_at DESC`;

        const [rows] = await pool.execute(query, params);
        
        console.log(`✅ Filter Query Success: ${rows.length} tickets returned`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error("❌ Filter Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch tickets." });
    }
});

export default router;
