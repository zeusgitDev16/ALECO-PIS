/**
 * Footer / contact lines for print-style posters. Override via Vite env (no vendor hostnames in logic).
 * @returns {{ disclaimer: string, facebook: string, email: string, smart: string, globe: string }}
 */
export function getPosterFooterContact() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  return {
    disclaimer:
      env.VITE_POSTER_DISCLAIMER ||
      'Power Service will be restored upon completion of work without prior notice. PLEASE CONSIDER OUR DISTRIBUTION LINES ALWAYS ENERGIZED.',
    facebook: env.VITE_POSTER_FOOTER_FB || 'https://facebook.com/albayelectric',
    email: env.VITE_POSTER_FOOTER_EMAIL || 'aleco.cares@gmail.com',
    smart: env.VITE_POSTER_FOOTER_SMART || '0908-6773-393 (SMART)',
    globe: env.VITE_POSTER_FOOTER_GLOBE || '0915-9953-455 (GLOBE)',
  };
}
