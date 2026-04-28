import React, { useRef, useCallback, useEffect } from 'react';
import InterruptionFeedPostBody from './InterruptionFeedPostBody';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import {
  isEmergencyOutageType,
  getStatusDisplayLabel,
  interruptionStatusForCssClass,
} from '../../utils/interruptionLabels';

/**
 * Poster-only feed card — no header/logo. Clicking the card opens the full-details modal.
 * A floating status banner hangs at the top of the poster.
 * @param {{ item: object, now: number, onExpand?: function, isExpandedView?: boolean }} props
 */
export default function InterruptionFeedPost({ item, now, onExpand, isExpandedView = false }) {
  const cardRef = useRef(null);
  const imgRef = useRef(null);
  const isBlankStub = typeof item.posterImageUrl === 'string' && item.posterImageUrl.includes('_stub');
  const safePosterUrl = (!isBlankStub && item.posterImageUrl) ? getSafeResourceUrl(item.posterImageUrl) : null;
  const typeModifier = isEmergencyOutageType(item.type) ? 'emergency'
    : item.type === 'NgcScheduled' ? 'ngcscheduled'
    : item.type === 'CustomPoster' ? 'customposter'
    : 'scheduled';
  const startMs = item.dateTimeStart ? Date.parse(String(item.dateTimeStart)) : Number.NaN;
  const effectiveStatus =
    item.status === 'Ongoing' && Number.isFinite(startMs) && startMs > now
      ? 'Pending'
      : item.status;
  const statusClass = interruptionStatusForCssClass(effectiveStatus);
  const statusLabel = getStatusDisplayLabel(effectiveStatus);
  const clickable = !isExpandedView && Boolean(onExpand);

  const applyPosterWidth = useCallback(() => {
    const img = imgRef.current;
    const card = cardRef.current;
    if (!card || !img || !img.naturalWidth || !img.naturalHeight) return;
    const cardH = card.offsetHeight;
    if (!cardH) return;
    const w = Math.ceil(cardH * (img.naturalWidth / img.naturalHeight));
    card.style.maxWidth = `${w}px`;
  }, []);

  useEffect(() => {
    applyPosterWidth();
  }, [applyPosterWidth]);

  return (
    <article
      ref={cardRef}
      className={`interruption-feed-post interruption-feed-post--type-${typeModifier}${safePosterUrl ? ' interruption-feed-post--poster' : ''}`}
      onClick={clickable ? onExpand : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onExpand(); } : undefined}
      aria-label={clickable ? 'View advisory details' : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
    >
      <div className="feed-post-status-banner">
        <span className={`feed-post-status-chip feed-post-status-chip--${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {safePosterUrl ? (
        <div className="feed-post-poster-display">
          <img
            ref={imgRef}
            src={safePosterUrl}
            alt="Advisory poster"
            className="feed-post-poster-img"
            onLoad={applyPosterWidth}
          />
        </div>
      ) : (
        <div className="feed-post-no-image-body">
          <InterruptionFeedPostBody item={item} />
          <InterruptionAdvisoryInfographic item={item} now={now} />
        </div>
      )}
    </article>
  );
}
