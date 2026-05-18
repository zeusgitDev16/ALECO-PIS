import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import {
  getStatusDisplayLabel,
  interruptionStatusForCssClass,
  getCauseCategoryLabel,
} from '../../utils/interruptionLabels';
import { shareToFacebook, shareToMessenger, shareNative, copyAdvisoryLink } from '../../utils/advisoryShare';
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

        {/* ── Top bar: status + type + ref + share + close ─────────────────── */}
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
          <div className="feed-expanded-topbar-right">
            {/* Share to Facebook */}
            <button
              type="button"
              className="feed-expanded-share-btn feed-expanded-share-btn--facebook"
              onClick={() => shareToFacebook(item.id)}
              title="Share to Facebook"
              aria-label="Share to Facebook"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </button>
            {/* Share to Messenger */}
            <button
              type="button"
              className="feed-expanded-share-btn feed-expanded-share-btn--messenger"
              onClick={() => shareToMessenger(item.id)}
              title="Share to Messenger"
              aria-label="Share to Messenger"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.36 5.23 3.5 6.85V22l4.09-2.24c1.03.28 2.12.44 3.26.44 5.52 0 10-4.03 10-9s-4.48-9-10-9zm1.09 12.28l-2.53-2.69-4.95 2.69 5.45-5.76 2.53 2.69 4.9-2.69-5.4 5.76z" />
              </svg>
            </button>
            {/* Native share (mobile) */}
            <button
              type="button"
              className="feed-expanded-share-btn feed-expanded-share-btn--native"
              onClick={() => shareNative(item)}
              title="More sharing options"
              aria-label="More sharing options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <path d="m16 6-4-4-4 4" />
                <path d="M12 2v13" />
              </svg>
            </button>
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
            ) : item.type === 'CustomPoster' ? (
              <p className="feed-expanded-poster-custom-placeholder">Custom poster image not yet uploaded.</p>
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
