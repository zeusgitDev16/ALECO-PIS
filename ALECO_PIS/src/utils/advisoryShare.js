/**
 * Advisory sharing utilities for Facebook and Messenger
 * Uses URL-based sharing (no SDK required)
 */

const BASE_URL = 'https://api.apisph.org';

/**
 * Generate the public permalink for an advisory
 * @param {number} advisoryId
 * @returns {string}
 */
export function getAdvisoryPermalink(advisoryId) {
  // Must match the React Router path in App.jsx: /poster/interruption/:id
  return `${BASE_URL}/poster/interruption/${advisoryId}`;
}

/**
 * Share advisory to Facebook
 * Opens Facebook sharer in a popup window
 * @param {number} advisoryId
 */
export function shareToFacebook(advisoryId) {
  const url = encodeURIComponent(getAdvisoryPermalink(advisoryId));
  // Use Facebook's newer share dialog with quote parameter for better preview
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent('Check out this power interruption advisory from ALECO')}`;
  
  // Larger popup for better UX with Facebook's current UI
  const width = 650;
  const height = 650;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  
  window.open(
    shareUrl,
    'facebook-share',
    `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1`
  );
}

/**
 * Share advisory to Facebook Messenger
 * Opens Messenger send dialog in a popup window
 * Note: Requires Facebook App ID for full functionality
 * @param {number} advisoryId
 */
export function shareToMessenger(advisoryId) {
  const url = encodeURIComponent(getAdvisoryPermalink(advisoryId));
  const shareUrl = `https://www.facebook.com/dialog/send?link=${url}&redirect_uri=${encodeURIComponent(window.location.href)}`;
  
  const width = 600;
  const height = 500;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  
  window.open(
    shareUrl,
    'messenger-share',
    `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0`
  );
}

/**
 * Copy advisory link to clipboard
 * @param {number} advisoryId
 * @returns {Promise<boolean>}
 */
export async function copyAdvisoryLink(advisoryId) {
  try {
    const link = getAdvisoryPermalink(advisoryId);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (err) {
    console.error('Failed to copy link:', err);
    return false;
  }
}

/**
 * Open native share dialog (mobile devices)
 * @param {object} item - Advisory item with id, feeder, affectedAreas, etc.
 * @returns {Promise<boolean>} - true if native share was used
 */
export async function shareNative(item) {
  if (!navigator.share) return false;
  
  const areas = (item.affectedAreas || []).join(', ') || 'Affected areas';
  const title = `Power Interruption Advisory - ${item.feeder || 'ALECO'}`;
  const text = `Power interruption scheduled for ${areas}. Stay informed with ALECO's advisories.`;
  
  try {
    await navigator.share({
      title,
      text,
      url: getAdvisoryPermalink(item.id),
    });
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false;
    console.error('Native share failed:', err);
    return false;
  }
}
