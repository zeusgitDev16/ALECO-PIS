import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicInterruptionSnapshot } from '../../api/interruptionsApi';
import { useNow } from '../../hooks/useNow';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
import '../../CSS/InterruptionFeed.css';
import '../../CSS/PublicInterruptionPosterPage.css';

function mapPosterLoadError(message) {
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('not found or not public') || lower.includes('not public')) {
    return 'This advisory is currently hidden from the public feed (pulled/archived) or not yet scheduled to go live.';
  }
  return raw || 'Could not load advisory.';
}

/**
 * Minimal public page for print / headless capture (Puppeteer). Uses the same infographic as the home feed.
 */
export default function PublicInterruptionPosterPage() {
  const { id: idParam } = useParams();
  const id = parseInt(String(idParam || ''), 10);
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const now = useNow([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(id) || id <= 0) {
        setError('Invalid advisory id.');
        return;
      }
      const r = await getPublicInterruptionSnapshot(id);
      if (cancelled) return;
      if (r.success && r.data) {
        setItem(r.data);
        setError(null);
      } else {
        setItem(null);
        setError(mapPosterLoadError(r.message));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="public-poster-page public-poster-page--error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="public-poster-page public-poster-page--loading" aria-live="polite">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="public-poster-page">
      <InterruptionAdvisoryInfographic item={item} now={now} />
    </div>
  );
}
