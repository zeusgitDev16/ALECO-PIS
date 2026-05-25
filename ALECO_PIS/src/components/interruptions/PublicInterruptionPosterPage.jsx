import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getShareInterruptionSnapshot } from '../../api/interruptionsApi';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import {
  getStatusDisplayLabel,
  getTypeDisplayLabel,
  interruptionStatusForCssClass,
  getCauseCategoryLabel,
  isEmergencyOutageType,
} from '../../utils/interruptionLabels';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
import InterruptionAlecoPrintPoster from './InterruptionAlecoPrintPoster';
import InterruptionNgcpPrintPoster from './InterruptionNgcpPrintPoster';
import '../../CSS/InterruptionPrintPoster.css';
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
      const r = await getShareInterruptionSnapshot(id);
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

  const statusClass = interruptionStatusForCssClass(item.status);
  const statusLabel = getStatusDisplayLabel(item.status);
  const typeLabel = getTypeDisplayLabel(item.type);
  const isEmergency = isEmergencyOutageType(item.type);
  const isNgcp = item.type === 'NgcScheduled';
  const isCustom = item.type === 'CustomPoster';
  const typeModifier = isEmergency ? 'emergency'
    : isNgcp ? 'ngcscheduled'
    : isCustom ? 'customposter'
    : 'scheduled';
  const grouped =
    Array.isArray(item.affectedAreasGrouped) && item.affectedAreasGrouped.length > 0
      ? item.affectedAreasGrouped
      : null;

  const isBlankStub =
    typeof item.posterImageUrl === 'string' && item.posterImageUrl.includes('_stub');
  const safePosterUrl =
    !isBlankStub && item.posterImageUrl
      ? getSafeResourceUrl(item.posterImageUrl)
      : null;
  const safeAdvisoryImageUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;

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

      <div className={`public-poster-shell pp-type--${typeModifier}`}>

        {/* Top bar: status + type + control no */}
        <div className="pp-topbar">
          <span className={`pp-status-chip pp-status-chip--${statusClass}`}>
            {statusLabel}
          </span>
          <span className={`pp-type pp-type--${typeModifier}`}>{typeLabel}</span>
          {item.controlNo && <span className="pp-ref">#{item.controlNo}</span>}
        </div>

        {/* Poster image — full width */}
        <div className="pp-poster-wrap">
          {safePosterUrl ? (
            <img
              src={safePosterUrl}
              alt={`Power interruption advisory for ${item.feeder}`}
              className="pp-poster-img"
              loading="lazy"
            />
          ) : (
            <div className="pp-poster-fallback">
              {isNgcp ? (
                <InterruptionNgcpPrintPoster item={item} />
              ) : isCustom ? (
                <p className="pp-custom-notice">Custom poster advisory &mdash; no generated template.</p>
              ) : (
                <InterruptionAlecoPrintPoster item={item} />
              )}
            </div>
          )}
        </div>

        {/* Details — mirrors the expanded-view modal structure */}
        <div className="pp-details">

          {/* Schedule */}
          <div className="pp-section">
            <h3 className="pp-section-title">
              {isEmergency ? 'Outage Timeline' : 'Schedule'}
            </h3>
            <div className="pp-row">
              <span className="pp-label">
                {isEmergency ? 'Outage Reported' : 'Outage Start'}
              </span>
              <span className="pp-value">
                {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '\u2014'}
              </span>
            </div>
            <div className="pp-row">
              <span className="pp-label">Est. Restore</span>
              <span className="pp-value">
                {item.dateTimeEndEstimated ? formatToPhilippineTime(item.dateTimeEndEstimated) : '\u2014'}
              </span>
            </div>
            {item.dateTimeRestored && (
              <div className="pp-row">
                <span className="pp-label">Power Restored</span>
                <span className="pp-value pp-value--restored">
                  {formatToPhilippineTime(item.dateTimeRestored)}
                </span>
              </div>
            )}
          </div>

          {/* Cause */}
          <div className="pp-section">
            <h3 className="pp-section-title">Cause</h3>
            <div className="pp-row">
              <span className="pp-label">Reason</span>
              <span className="pp-value">{item.cause || '\u2014'}</span>
            </div>
            {item.causeCategory && (
              <div className="pp-row">
                <span className="pp-label">Category</span>
                <span className="pp-value">{getCauseCategoryLabel(item.causeCategory)}</span>
              </div>
            )}
          </div>

          {/* Substation / Feeder */}
          <div className="pp-section">
            <h3 className="pp-section-title">
              {isNgcp ? 'Source / Feeder' : 'Substation / Feeder'}
            </h3>
            <p className="pp-pill">{item.feeder || '\u2014'}</p>
          </div>

          {/* Affected Areas — Dual Pane */}
          <div className="pp-section">
            <h3 className="pp-section-title">Affected Areas</h3>
            <div className="pp-areas-dual-pane">
              {/* Left: Comma-separated areas */}
              <div className="pp-areas-left">
                <h4 className="pp-areas-subtitle">Areas</h4>
                <p className="pp-areas-comma-list">
                  {affectedAreas.length > 0 ? affectedAreas.join(', ') : '\u2014'}
                </p>
              </div>
              {/* Right: Portions of with bullets */}
              <div className="pp-areas-right">
                <h4 className="pp-areas-subtitle">Portions Of</h4>
                {grouped ? (
                  grouped.map((g, gi) => (
                    <div key={gi}>
                      {g.heading && <p className="pp-area-group-heading">{g.heading}</p>}
                      <ul className="pp-area-list">
                        {g.items.map((a, ai) => (
                          <li key={ai} style={{ whiteSpace: 'pre-wrap', listStyleType: a.trim() === '' ? 'none' : 'inherit' }}>
                            {a.trim() === '' ? '\u200B' : a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <ul className="pp-area-list">
                    {affectedAreas.length > 0
                      ? affectedAreas.map((a, i) => <li key={i}>{a}</li>)
                      : <li>\u2014</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Additional Details */}
          {item.body && String(item.body).trim() && (
            <div className="pp-section">
              <h3 className="pp-section-title">Additional Details</h3>
              <p className="pp-body-text">{item.body}</p>
            </div>
          )}

          {/* Attached Image (NGCP source doc or uploaded image) */}
          {safeAdvisoryImageUrl && (
            <div className="pp-section">
              <h3 className="pp-section-title">
                {isNgcp ? 'NGCP Source Document' : 'Attached Image'}
              </h3>
              <div className="pp-attached-image-wrap">
                <img
                  src={safeAdvisoryImageUrl}
                  alt={isNgcp ? 'NGCP source document' : 'Attached advisory image'}
                  className="pp-attached-image"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Meta timestamps */}
          <div className="pp-section pp-section--meta">
            {item.createdAt && (
              <span className="pp-meta-item">
                <strong>Posted:</strong> {formatToPhilippineTime(item.createdAt)}
              </span>
            )}
            {item.updatedAt &&
              String(item.updatedAt).trim() !== String(item.createdAt).trim() && (
                <span className="pp-meta-item">
                  <strong>Updated:</strong> {formatToPhilippineTime(item.updatedAt)}
                </span>
              )}
          </div>

        </div>

        {/* Footer */}
        <div className="pp-footer">
          Albay Electric Cooperative, Inc. &mdash;
          {' '}<a href="mailto:aleco.cares@gmail.com">aleco.cares@gmail.com</a>
          {' '}| 0908-6773-393 (SMART) | 0915-9953-455 (GLOBE)
        </div>

      </div>
    </div>
  );
}
