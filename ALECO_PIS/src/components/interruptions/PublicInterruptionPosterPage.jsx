import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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

  const baseUrl = window.location.origin;
  const advisoryUrl = `${baseUrl}/poster/interruption/${id}`;
  // posterUrl is a full Cloudinary URL, use it directly
  const posterImageUrl = item.posterUrl && item.posterUrl.startsWith('http') 
    ? item.posterUrl 
    : `${baseUrl}/og-default.jpg`;
  const affectedAreas = (item.affectedAreas || []).join(', ') || 'Affected areas';
  const ogTitle = `Power Interruption Advisory - ${item.feeder || 'ALECO'} | ${item.status}`;
  const ogDescription = `Scheduled power interruption for ${affectedAreas}. Date: ${item.date || 'TBA'}. Status: ${item.status}.`;

  return (
    <div className="public-poster-page">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />

        {/* Open Graph tags for Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={advisoryUrl} />
        <meta property="og:image" content={posterImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`Power interruption advisory poster for ${item.feeder}`} />
        <meta property="article:published_time" content={item.createdAt} />
        <meta property="article:modified_time" content={item.updatedAt || item.createdAt} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={posterImageUrl} />
      </Helmet>

      {/* Poster-first display: Show poster image prominently, details below */}
      <div className="poster-container">
        {item.posterUrl && item.posterUrl.startsWith('http') ? (
          <>
            <img 
              src={item.posterUrl} 
              alt={`Power interruption advisory for ${item.feeder}`}
              className="advisory-poster-image"
              style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
            />
            {/* Advisory details below the poster */}
            <div className="advisory-details" style={{ marginTop: '20px', padding: '20px' }}>
              <h1>Power Interruption Advisory</h1>
              <p><strong>Feeder:</strong> {item.feeder}</p>
              <p><strong>Status:</strong> {item.status}</p>
              <p><strong>Date:</strong> {item.date || 'TBA'}</p>
              <p><strong>Affected Areas:</strong> {affectedAreas}</p>
              <p><strong>Cause:</strong> {item.cause || 'N/A'}</p>
              {item.body && <p><strong>Details:</strong> {item.body}</p>}
            </div>
          </>
        ) : (
          // Fallback: Show old infographic display when poster is unavailable
          <InterruptionAdvisoryInfographic item={item} now={now} />
        )}
      </div>
    </div>
  );
}
