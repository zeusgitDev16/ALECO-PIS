import express from 'express';
import pool from '../config/db.js';
import { listUrgentKeywords, replaceUrgentKeywords } from '../utils/urgentKeywordsDb.js';

const router = express.Router();

const MAX_KEYWORDS = 200;

/**
 * GET /urgent-keywords
 * Public: used by Report a Problem and admin panel.
 */
router.get('/urgent-keywords', async (req, res) => {
    try {
        const keywords = await listUrgentKeywords(pool);
        return res.json({ success: true, keywords });
    } catch (err) {
        console.error('❌ GET /urgent-keywords:', err);
        return res.status(500).json({ success: false, message: 'Failed to load urgent keywords' });
    }
});

/**
 * PUT /urgent-keywords
 * Body: { keywords: string[] }
 */
router.put('/urgent-keywords', async (req, res) => {
    try {
        const { keywords: raw } = req.body || {};
        if (!Array.isArray(raw)) {
            return res.status(400).json({ success: false, message: 'Body must include keywords array' });
        }
        if (raw.length > MAX_KEYWORDS) {
            return res.status(400).json({
                success: false,
                message: `At most ${MAX_KEYWORDS} keywords allowed`
            });
        }
        const saved = await replaceUrgentKeywords(pool, raw);
        return res.json({ success: true, keywords: saved });
    } catch (err) {
        console.error('❌ PUT /urgent-keywords:', err);
        if (err instanceof TypeError) {
            return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(500).json({ success: false, message: 'Failed to save urgent keywords' });
    }
});

export default router;
