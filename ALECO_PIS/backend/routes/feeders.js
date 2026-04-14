import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

/**
 * GET /feeders
 * Public read endpoint for advisory composer / other clients.
 */
router.get('/feeders', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                a.id AS area_id,
                a.area_code,
                a.area_label,
                a.display_order AS area_order,
                f.id AS feeder_id,
                f.feeder_code,
                f.feeder_label,
                f.display_order AS feeder_order
             FROM aleco_feeder_areas a
             JOIN aleco_feeders f ON f.area_id = a.id
             WHERE a.is_active = 1 AND f.is_active = 1
             ORDER BY a.display_order ASC, a.id ASC, f.display_order ASC, f.id ASC`
        );

        const byArea = new Map();
        for (const r of rows) {
            if (!byArea.has(r.area_id)) {
                byArea.set(r.area_id, {
                    id: r.area_id,
                    code: r.area_code,
                    label: r.area_label,
                    feeders: [],
                });
            }
            byArea.get(r.area_id).feeders.push({
                id: r.feeder_id,
                code: r.feeder_code,
                label: r.feeder_label,
            });
        }

        return res.json({
            success: true,
            areas: Array.from(byArea.values()),
        });
    } catch (err) {
        console.error('❌ GET /feeders:', err);
        return res.status(500).json({ success: false, message: 'Failed to load feeder catalog' });
    }
});

export default router;
