import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInterruption } from '../../api/interruptionsApi';
import { useNow } from '../../hooks/useNow';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
import '../../CSS/InterruptionFeed.css';
import '../../CSS/PublicInterruptionPosterPage.css';

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
      const r = await getInterruption(id);
      if (cancelled) return;
      if (r.success && r.data) {
        setItem(r.data);
        setError(null);
      } else {
        setItem(null);
        setError(r.message || 'Could not load advisory.');
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
