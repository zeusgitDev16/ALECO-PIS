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
