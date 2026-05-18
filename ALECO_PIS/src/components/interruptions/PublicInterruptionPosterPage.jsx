import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPublicInterruptionSnapshot } from '../../api/interruptionsApi';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
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
 * Professional public advisory page with full-screen poster and elegant details
 */
export default function PublicInterruptionPosterPage() {
  const { id: idParam } = useParams();
  const id = parseInt(String(idParam || ''), 10);
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

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
  const posterImageUrl = item.posterImageUrl && item.posterImageUrl.startsWith('http') 
    ? item.posterImageUrl 
    : `${baseUrl}/og-default.jpg`;
  const affectedAreas = item.affectedAreas || [];
  const ogTitle = `Power Interruption Advisory - ${item.feeder || 'ALECO'} | ${item.status}`;
  const ogDescription = `Scheduled power interruption${affectedAreas.length ? ' for ' + affectedAreas.join(', ') : ''}. Date: ${item.date || 'TBA'}. Status: ${item.status}.`;
  
  // Status styling
  const statusClass = item.status?.toLowerCase().includes('ongoing') ? 'status-ongoing' 
    : item.status?.toLowerCase().includes('complet') ? 'status-completed' 
    : 'status-pending';

  return (
    <div className="public-poster-page">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
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
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={posterImageUrl} />
      </Helmet>

      {/* Header Banner */}
      <header className="advisory-header">
        <h2>🔌 ALECO Power Interruption Advisory</h2>
      </header>

      {item.posterImageUrl && item.posterImageUrl.startsWith('http') ? (
        <>
          {/* Full-Screen Poster Section */}
          <section className="poster-section">
            <div className="poster-wrapper">
              <img 
                src={item.posterImageUrl} 
                alt={`Power interruption advisory for ${item.feeder}`}
                className="advisory-poster-image"
              />
            </div>
          </section>

          {/* Details Section */}
          <section className="details-section">
            <div className="details-header">
              <h1>{item.feeder || 'Power Interruption Advisory'}</h1>
              <p className="subtitle">Albay Electric Cooperative, Inc.</p>
            </div>

            <div className="info-grid">
              <div className={`info-item ${statusClass}`}>
                <div className="info-icon">⚡</div>
                <div className="info-content">
                  <div className="info-label">Status</div>
                  <div className="info-value">{item.status}</div>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">📅</div>
                <div className="info-content">
                  <div className="info-label">Date</div>
                  <div className="info-value">{item.date || 'To Be Announced'}</div>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">📍</div>
                <div className="info-content">
                  <div className="info-label">Feeder</div>
                  <div className="info-value">{item.feeder}</div>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">🔧</div>
                <div className="info-content">
                  <div className="info-label">Cause</div>
                  <div className="info-value">{item.cause || 'Maintenance Work'}</div>
                </div>
              </div>

              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <div className="info-icon">🏘️</div>
                <div className="info-content">
                  <div className="info-label">Affected Areas</div>
                  <div className="affected-areas-list">
                    {affectedAreas.length > 0 ? (
                      affectedAreas.map((area, idx) => (
                        <span key={idx} className="area-tag">{area}</span>
                      ))
                    ) : (
                      <span className="area-tag">Areas to be announced</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {item.body && (
              <div className="details-body">
                <h3>📝 Additional Details</h3>
                <p>{item.body}</p>
              </div>
            )}
          </section>

          <footer className="page-footer">
            <p>For more information, contact ALECO at <a href="mailto:aleco.cares@gmail.com">aleco.cares@gmail.com</a></p>
            <p style={{ marginTop: '8px', fontSize: '0.75rem' }}>© 2026 Albay Electric Cooperative, Inc.</p>
          </footer>
        </>
      ) : (
        <section className="poster-section">
          <InterruptionAdvisoryInfographic item={item} now={new Date()} />
        </section>
      )}
    </div>
  );
}
