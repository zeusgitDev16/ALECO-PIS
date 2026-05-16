import express from 'express';
import pool from '../config/db.js';
import { upload, cloudinary } from '../../cloudinaryConfig.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { extractCloudinaryPublicId } from '../utils/cloudinaryUtils.js';

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
    const allowedKeys = [
      'site_title', 
      'site_description', 
      'contact_email', 
      'phone_number', 
      'site_logo_url', 
      'site_favicon_url'
    ];
    const filteredUpdates = Object.entries(updates).filter(([key]) => allowedKeys.includes(key));

    if (filteredUpdates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid settings provided.' });
    }

    for (const [key, value] of filteredUpdates) {
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
 * Admin: Get Cloudinary Config for Upload Widget
 */
router.get('/site-settings/cloudinary-config', requireAdmin, (req, res) => {
  res.json({
    success: true,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME
  });
});

/**
 * Admin: Generate Cloudinary signature for signed widget uploads dynamically.
 */
router.post('/site-settings/cloudinary-signature', requireAdmin, (req, res) => {
  try {
    const paramsToSign = req.body;
    
    // The widget sends the exact parameters it wants signed
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({ success: true, signature });
  } catch (error) {
    console.error('[site-settings] signature error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate signature.' });
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
 * Admin: Reset site logo (delete from DB and Cloudinary).
 */
router.delete('/site-settings/logo', requireAdmin, async (req, res) => {
  try {
    // 1. Fetch current logo URL
    const [rows] = await pool.execute('SELECT setting_value FROM aleco_site_settings WHERE setting_key = ?', ['site_logo_url']);
    const currentUrl = rows[0]?.setting_value;

    // 2. If it's a Cloudinary URL, delete the asset
    if (currentUrl) {
      const publicId = extractCloudinaryPublicId(currentUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
        } catch (cloudinaryError) {
          console.warn('[site-settings] Cloudinary destroy failed:', cloudinaryError.message);
          // Continue with DB deletion anyway
        }
      }
    }

    // 3. Delete from DB
    await pool.execute('DELETE FROM aleco_site_settings WHERE setting_key = ?', ['site_logo_url']);
    
    res.json({ success: true, message: 'Logo reset and storage cleaned up.' });
  } catch (error) {
    console.error('[site-settings] logo reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset logo.' });
  }
});

/**
 * Admin: Reset site favicon (delete from DB and Cloudinary).
 */
router.delete('/site-settings/favicon', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT setting_value FROM aleco_site_settings WHERE setting_key = ?', ['site_favicon_url']);
    const currentUrl = rows[0]?.setting_value;

    if (currentUrl) {
      const publicId = extractCloudinaryPublicId(currentUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
        } catch (cloudinaryError) {
          console.warn('[site-settings] Favicon Cloudinary destroy failed:', cloudinaryError.message);
        }
      }
    }

    await pool.execute('DELETE FROM aleco_site_settings WHERE setting_key = ?', ['site_favicon_url']);
    res.json({ success: true, message: 'Favicon reset and storage cleaned up.' });
  } catch (error) {
    console.error('[site-settings] favicon reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset favicon.' });
  }
});

export default router;
