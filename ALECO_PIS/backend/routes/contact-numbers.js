import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

/**
 * GET /api/contact-numbers
 * Returns active hotlines and business numbers for Report a Problem
 */
router.get('/contact-numbers', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT category, label, phone_number, description 
             FROM aleco_contact_numbers 
             WHERE is_active = 1 
             ORDER BY display_order ASC, id ASC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('❌ contact-numbers error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch contact numbers' });
    }
});

export default router;
