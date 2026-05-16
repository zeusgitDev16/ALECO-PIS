import express from 'express';
import pool from '../config/db.js';
import { upload, cloudinary } from '../../cloudinaryConfig.js';
import { requireAdmin } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * Public: Get all site settings.
 */
router.get('/site-settings', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT setting_key, setting_value FROM aleco_site_settings');
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[site-settings] fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch site settings.' });
  }
});

/**
 * Admin: Update site settings (text-based).
 */
router.patch('/site-settings', requireAdmin, async (req, res) => {
  const updates = req.body; // { key: value }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid payload.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(updates)) {
      await conn.execute(
        'INSERT INTO aleco_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    await conn.commit();
    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('[site-settings] update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update site settings.' });
  } finally {
    conn.release();
  }
});

/**
 * Admin: Upload site logo to Cloudinary and update DB.
 */
router.post('/site-settings/upload-logo', requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const logoUrl = req.file.path;
    await pool.execute(
      'INSERT INTO aleco_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      ['site_logo_url', logoUrl, logoUrl]
    );

    res.json({ success: true, logoUrl, message: 'Logo uploaded and saved successfully.' });
  } catch (error) {
    console.error('[site-settings] logo upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload logo.' });
  }
});

/**
 * Admin: Reset site logo (delete from DB).
 */
router.delete('/site-settings/logo', requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM aleco_site_settings WHERE setting_key = ?', ['site_logo_url']);
    res.json({ success: true, message: 'Logo reset to default.' });
  } catch (error) {
    console.error('[site-settings] logo reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset logo.' });
  }
});

export default router;
