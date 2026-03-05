import express from 'express';
import db from '../config/db.js';
// IMPORTANT: Adjust this path and add '.js' if your project requires extensions!

const router = express.Router();

// Changed from '/tickets' to '/filtered-tickets' to protect your existing routes!
router.get('/filtered-tickets', async (req, res) => {
    try {
        const { 
            tab, isNew, searchQuery, category, district, 
            municipality, barangay, purok, datePreset, startDate, endDate
        } = req.query;

        let query = `SELECT * FROM aleco_tickets WHERE 1=1`;
        const params = [];

        // --- Status Tabs ---
       if (tab === 'Open') {
            // Shows Pending, Ongoing, OR any ticket that accidentally has a NULL/Empty status
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
        if (barangay) { query += ` AND barangay = ?`; params.push(barangay); }
        if (purok) { query += ` AND purok = ?`; params.push(purok); }

        // --- Date Logic ---
        if (datePreset) {
            switch (datePreset) {
                case 'today':
                    query += ` AND DATE(created_at) = CURDATE()`;
                    break;
                case 'last7':
                    query += ` AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
                    break;
                case 'thisMonth':
                    query += ` AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`;
                    break;
                case 'lastMonth':
                    query += ` AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
                    break;
                case 'custom':
                    if (startDate && endDate) {
                        query += ` AND created_at BETWEEN ? AND ?`;
                        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
                    }
                    break;
            }
        }

        query += ` ORDER BY created_at DESC`;

        console.log("SQL EXECUTION:", query);
        console.log("WITH PARAMS:", params);

        const [rows] = await db.query(query, params);

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("Error fetching filtered tickets:", error);
        res.status(500).json({ success: false, message: "Failed to fetch tickets." });
    }
});

export default router;