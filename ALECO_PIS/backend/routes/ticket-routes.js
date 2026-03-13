import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// IDEMPOTENT FILTER ROUTE: Returns tickets based on admin dashboard filters
router.get('/filtered-tickets', async (req, res) => {
    try {
        const { 
            tab, isNew, searchQuery, category, 
            district, municipality, 
            datePreset, startDate, endDate
        } = req.query;

        console.log('🔍 Filter Request:', { tab, isNew, searchQuery, category, district, municipality, datePreset });

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

        // --- Search Bar (ID, Name, Concern) ---
        if (searchQuery && searchQuery.trim() !== '') {
            query += ` AND (
                ticket_id LIKE ? OR 
                first_name LIKE ? OR 
                last_name LIKE ? OR 
                concern LIKE ? OR
                address LIKE ?
            )`;
            const searchWildcard = `%${searchQuery.trim()}%`;
            params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
        }

        // --- Category Filter ---
        if (category && category.trim() !== '') {
            query += ` AND category = ?`;
            params.push(category.trim());
        }

        // --- Location Filters (District & Municipality ONLY) ---
        if (district && district.trim() !== '') {
            query += ` AND district = ?`;
            params.push(district.trim());
        }

        if (municipality && municipality.trim() !== '') {
            query += ` AND municipality = ?`;
            params.push(municipality.trim());
        }

        // --- Date Filters ---
        if (datePreset) {
            if (datePreset === 'today') {
                query += ` AND DATE(created_at) = CURDATE()`;
            } else if (datePreset === 'last7') {
                query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (datePreset === 'thisMonth') {
                query += ` AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`;
            } else if (datePreset === 'lastMonth') {
                query += ` AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
                           AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
            }
        }

        // --- Custom Date Range ---
        if (startDate && endDate) {
            query += ` AND DATE(created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY created_at DESC`;

        console.log('📊 Executing Query:', query);
        console.log('📊 With Params:', params);

        const [rows] = await pool.execute(query, params);
        
        console.log(`✅ Filter Query Success: ${rows.length} tickets returned`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error("❌ Filter Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch tickets." });
    }
});

export default router;
