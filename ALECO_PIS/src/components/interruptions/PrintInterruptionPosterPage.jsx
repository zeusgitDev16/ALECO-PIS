import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicInterruptionSnapshot } from '../../api/interruptionsApi';
import InterruptionAlecoPrintPoster from './InterruptionAlecoPrintPoster';
import '../../CSS/InterruptionPrintPoster.css';

/**
 * Full ALECO print layout for server-side Puppeteer capture (`/print-interruption/:id`).
 */
export default function PrintInterruptionPosterPage() {
  const { id: idParam } = useParams();
  const id = parseInt(String(idParam || ''), 10);
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.classList.add('poster-capture-mode');
    return () => document.body.classList.remove('poster-capture-mode');
  }, []);

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
        setError(r.message || 'Could not load advisory.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="print-poster-page print-poster-page--error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="print-poster-page print-poster-page--loading" aria-live="polite">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="print-poster-page">
      <InterruptionAlecoPrintPoster item={item} />
    </div>
  );
}
