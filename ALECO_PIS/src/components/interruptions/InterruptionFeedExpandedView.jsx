import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import {
  getStatusDisplayLabel,
  interruptionStatusForCssClass,
  getCauseCategoryLabel,
} from '../../utils/interruptionLabels';
import InterruptionAlecoPrintPoster from './InterruptionAlecoPrintPoster';
import InterruptionNgcpPrintPoster from './InterruptionNgcpPrintPoster';
import '../../CSS/InterruptionPrintPoster.css';

/**
 * Fullscreen modal overlay: poster image (or infographic) + all advisory details.
 * @param {{ item: object, now: number, onClose: function }} props
 */
export default function InterruptionFeedExpandedView({ item, now, onClose }) {
  const isBlankStub =
    typeof item.posterImageUrl === 'string' && item.posterImageUrl.includes('_stub');
  const safePosterUrl =
    !isBlankStub && item.posterImageUrl
      ? getSafeResourceUrl(item.posterImageUrl)
      : null;
  const safeAdvisoryImageUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;
  const [showPosterFullImage, setShowPosterFullImage] = useState(false);

  const statusClass = interruptionStatusForCssClass(item.status);
  const statusLabel = getStatusDisplayLabel(item.status);
  const grouped =
    Array.isArray(item.affectedAreasGrouped) && item.affectedAreasGrouped.length > 0
      ? item.affectedAreasGrouped
      : null;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="feed-expanded-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Advisory full details"
    >
      <div className="feed-expanded-panel">

        {/* ── Top bar: status + type + ref + close ─────────────────── */}
        <div className="feed-expanded-topbar">
          <div className="feed-expanded-topbar-left">
            <span className={`feed-post-status-chip feed-post-status-chip--${statusClass}`}>
              {statusLabel}
            </span>
            <span className="feed-expanded-type">{item.type}</span>
            {item.controlNo && (
              <span className="feed-expanded-ref">#{item.controlNo}</span>
            )}
          </div>
          <button
            type="button"
            className="feed-expanded-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Visual: poster image or infographic ──────────────────── */}
        {safePosterUrl ? (
          <div className="feed-expanded-poster-wrap">
            <img
              src={safePosterUrl}
              alt="Advisory poster"
              className="feed-expanded-poster-img feed-expanded-poster-img--clickable"
              loading="lazy"
              onClick={() => setShowPosterFullImage(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowPosterFullImage(true)}
            />
          </div>
        ) : (
          <div className="feed-expanded-poster-wrap">
            {item.type === 'NgcScheduled' ? (
              <InterruptionNgcpPrintPoster item={item} />
            ) : (
              <InterruptionAlecoPrintPoster item={item} />
            )}
          </div>
        )}

        {/* ── Full advisory details ─────────────────────────────────── */}
        <div className="feed-expanded-details">

          {/* Schedule */}
          <div className="feed-expanded-section">
            <h3 className="feed-expanded-section-title">Schedule</h3>
            <div className="feed-expanded-row">
              <span className="feed-expanded-label">Outage Start</span>
              <span className="feed-expanded-value">
                {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
              </span>
            </div>
            <div className="feed-expanded-row">
              <span className="feed-expanded-label">Est. Restore</span>
              <span className="feed-expanded-value">
                {item.dateTimeEndEstimated
                  ? formatToPhilippineTime(item.dateTimeEndEstimated)
                  : '—'}
              </span>
            </div>
            {item.dateTimeRestored && (
              <div className="feed-expanded-row">
                <span className="feed-expanded-label">Power Restored</span>
                <span className="feed-expanded-value feed-expanded-value--restored">
                  {formatToPhilippineTime(item.dateTimeRestored)}
                </span>
              </div>
            )}
          </div>

          {/* Cause */}
          <div className="feed-expanded-section">
            <h3 className="feed-expanded-section-title">Cause</h3>
            <div className="feed-expanded-row">
              <span className="feed-expanded-label">Reason</span>
              <span className="feed-expanded-value">{item.cause || '—'}</span>
            </div>
            {item.causeCategory && (
              <div className="feed-expanded-row">
                <span className="feed-expanded-label">Category</span>
                <span className="feed-expanded-value">
                  {getCauseCategoryLabel(item.causeCategory)}
                </span>
              </div>
            )}
          </div>

          {/* Feeder */}
          <div className="feed-expanded-section">
            <h3 className="feed-expanded-section-title">Substation / Feeder</h3>
            <p className="feed-expanded-pill">{item.feeder || '—'}</p>
          </div>

          {/* Affected Areas */}
          <div className="feed-expanded-section">
            <h3 className="feed-expanded-section-title">Affected Areas</h3>
            {grouped ? (
              grouped.map((g, gi) => (
                <div key={gi} className="feed-expanded-group">
                  {g.heading && (
                    <p className="feed-expanded-group-heading">{g.heading}</p>
                  )}
                  <ul className="feed-expanded-area-list">
                    {g.items.map((a, ai) => <li key={ai}>{a}</li>)}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="feed-expanded-area-list">
                {(item.affectedAreas || []).length > 0
                  ? (item.affectedAreas || []).map((a, i) => <li key={i}>{a}</li>)
                  : <li>—</li>}
              </ul>
            )}
          </div>

          {/* Additional details / body text */}
          {item.body && String(item.body).trim() && (
            <div className="feed-expanded-section">
              <h3 className="feed-expanded-section-title">Additional Details</h3>
              <p className="feed-expanded-body-text">{item.body}</p>
            </div>
          )}

          {/* Uploaded advisory image (separate from poster image) */}
          {safeAdvisoryImageUrl && (
            <div className="feed-expanded-section">
              <h3 className="feed-expanded-section-title">Attached Image</h3>
              <div className="feed-expanded-attached-image-wrap">
                <img
                  src={safeAdvisoryImageUrl}
                  alt="Attached advisory"
                  className="feed-expanded-attached-image"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Meta timestamps */}
          <div className="feed-expanded-section feed-expanded-section--meta">
            {item.createdAt && (
              <span className="feed-expanded-meta-item">
                <strong>Posted:</strong> {formatToPhilippineTime(item.createdAt)}
              </span>
            )}
            {item.updatedAt &&
              String(item.updatedAt).trim() !== String(item.createdAt).trim() && (
                <span className="feed-expanded-meta-item">
                  <strong>Updated:</strong> {formatToPhilippineTime(item.updatedAt)}
                </span>
              )}
          </div>

        </div>
      </div>
      {safePosterUrl && showPosterFullImage && createPortal(
        <div
          className="full-screen-image-overlay"
          onClick={() => setShowPosterFullImage(false)}
        >
          <img src={safePosterUrl} alt="Poster full view" />
        </div>,
        document.body
      )}
    </div>
  );
}
