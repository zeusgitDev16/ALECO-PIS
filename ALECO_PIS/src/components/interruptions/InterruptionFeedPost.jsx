import React from 'react';
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
  const isBlankStub = typeof item.posterImageUrl === 'string' && item.posterImageUrl.includes('_stub');
  const safePosterUrl = (!isBlankStub && item.posterImageUrl) ? getSafeResourceUrl(item.posterImageUrl) : null;
  const typeModifier = isEmergencyOutageType(item.type) ? 'emergency'
    : item.type === 'NgcScheduled' ? 'ngcscheduled'
    : 'scheduled';
  const statusClass = interruptionStatusForCssClass(item.status);
  const statusLabel = getStatusDisplayLabel(item.status);
  const clickable = !isExpandedView && Boolean(onExpand);

  return (
    <article
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
            src={safePosterUrl}
            alt="Advisory poster"
            loading="lazy"
            className="feed-post-poster-img"
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
