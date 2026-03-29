import express from 'express';
import pool from '../config/db.js';
import { mapTicketRowToDto } from '../utils/ticketDto.js';

const router = express.Router();

// IDEMPOTENT FILTER ROUTE: Returns tickets based on admin dashboard filters
router.get('/filtered-tickets', async (req, res) => {
    try {
        const {
            tab, isNew, isUrgent, status, searchQuery, category,
            district, municipality,
            datePreset, startDate, endDate, groupFilter
        } = req.query;

        console.log('🔍 Filter Request:', { tab, isNew, isUrgent, status, searchQuery, category, district, municipality, datePreset, groupFilter });

        // Base: show parent tickets (GROUP-*) + ungrouped; exclude children and soft-deleted. Include child_count for GROUP masters.
        // deleted_at: DATETIME column - use IS NULL only. Fallback for DBs without deleted_at (pre-migration).
        let query = `SELECT t.*, 
            (SELECT COUNT(*) FROM aleco_tickets c WHERE c.parent_ticket_id = t.ticket_id AND c.deleted_at IS NULL) as child_count 
            FROM aleco_tickets t WHERE 1=1 AND t.deleted_at IS NULL`;
        const params = [];

        // --- Group Filter (base visibility) ---
        if (groupFilter === 'grouped') {
            query += ` AND t.ticket_id LIKE 'GROUP-%'`;
        } else if (groupFilter === 'ungrouped') {
            query += ` AND (t.parent_ticket_id IS NULL OR t.parent_ticket_id = '') AND t.ticket_id NOT LIKE 'GROUP-%'`;
        } else {
            // all: GROUP masters + ungrouped tickets (exclude children)
            query += ` AND (t.parent_ticket_id IS NULL OR t.parent_ticket_id = '' OR t.ticket_id LIKE 'GROUP-%')`;
        }

        // --- Status Tabs ---
        if (tab === 'Open') {
            query += ` AND (t.status IN ('Pending', 'Ongoing', 'Unresolved', 'OnHold') OR t.status IS NULL OR t.status = '')`;
        } else if (tab === 'Closed') {
            query += ` AND t.status IN ('Restored', 'NoFaultFound', 'AccessDenied')`;
        }

        // --- 48 Hour Toggle ---
        if (isNew === 'true') {
            query += ` AND t.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`;
        }

        // --- Urgent Filter ---
        if (isUrgent === 'true') {
            query += ` AND t.is_urgent = 1`;
        }

        // --- Status Filter ---
        if (status && status.trim() !== '') {
            query += ` AND t.status = ?`;
            params.push(status.trim());
        }

        // --- Search Bar (ID, Name, Concern) ---
        // When search matches a child ticket, show the parent group instead (children are hidden from list)
        if (searchQuery && searchQuery.trim() !== '') {
            const searchWildcard = `%${searchQuery.trim()}%`;
            query += ` AND (
                (t.ticket_id LIKE ? OR t.first_name LIKE ? OR t.last_name LIKE ? OR t.concern LIKE ? OR t.address LIKE ?)
                OR
                (t.ticket_id LIKE 'GROUP-%' AND EXISTS (
                    SELECT 1 FROM aleco_tickets c 
                    WHERE c.parent_ticket_id = t.ticket_id 
                    AND (c.ticket_id LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.concern LIKE ? OR c.address LIKE ?)
                ))
            )`;
            params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard,
                searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
        }

        // --- Category Filter ---
        if (category && category.trim() !== '') {
            query += ` AND t.category = ?`;
            params.push(category.trim());
        }

        // --- Location Filters (District & Municipality ONLY) ---
        if (district && district.trim() !== '') {
            query += ` AND t.district = ?`;
            params.push(district.trim());
        }

        if (municipality && municipality.trim() !== '') {
            query += ` AND t.municipality = ?`;
            params.push(municipality.trim());
        }

        // --- Date Filters ---
        if (datePreset) {
            if (datePreset === 'today') {
                query += ` AND DATE(t.created_at) = CURDATE()`;
            } else if (datePreset === 'last7') {
                query += ` AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (datePreset === 'thisMonth') {
                query += ` AND MONTH(t.created_at) = MONTH(CURDATE()) AND YEAR(t.created_at) = YEAR(CURDATE())`;
            } else if (datePreset === 'lastMonth') {
                query += ` AND MONTH(t.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
                           AND YEAR(t.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
            }
        }

        // --- Custom Date Range ---
        if (startDate && endDate) {
            query += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY t.created_at DESC`;

        console.log('📊 Executing Query:', query);
        console.log('📊 With Params:', params);

        const [rows] = await pool.execute(query, params);
        
        console.log(`✅ Filter Query Success: ${rows.length} tickets returned`);
        res.json({ success: true, data: rows.map(mapTicketRowToDto) });

    } catch (error) {
        console.error("❌ Filter Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch tickets." });
    }
});

export default router;
