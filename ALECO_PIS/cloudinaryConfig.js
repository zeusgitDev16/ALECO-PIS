import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'aleco_reports',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage: storage });

/**
 * Extract the Cloudinary public_id from a secure_url.
 * Format: https://res.cloudinary.com/{cloud}/{type}/upload/[v{n}/]{public_id}.{ext}
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/i);
  if (!match) return null;
  const pathWithExt = match[1].split('?')[0];
  const lastDot = pathWithExt.lastIndexOf('.');
  if (lastDot === -1) return pathWithExt;
  const ext = pathWithExt.slice(lastDot + 1);
  return /^[a-z0-9]{2,5}$/i.test(ext) ? pathWithExt.slice(0, lastDot) : pathWithExt;
}

/**
 * Best-effort Cloudinary asset deletion by URL.
 * Silently skips non-Cloudinary URLs or if Cloudinary is not configured.
 * Never throws — errors are only logged.
 * @param {string|null|undefined} url
 */
export async function deleteCloudinaryAssetByUrl(url) {
  try {
    const publicId = extractCloudinaryPublicId(url);
    if (!publicId) return;
    if (!process.env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.destroy) return;
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (e) {
    console.warn('[cloudinary] deleteCloudinaryAssetByUrl:', e?.message || e);
  }
}

// THE KEY CHANGE: Use export instead of module.exports
export { cloudinary, upload };