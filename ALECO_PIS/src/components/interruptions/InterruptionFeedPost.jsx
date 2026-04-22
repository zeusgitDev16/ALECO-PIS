import React from 'react';
import InterruptionFeedPostHeader from './InterruptionFeedPostHeader';
import InterruptionFeedPostBody from './InterruptionFeedPostBody';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';
import { getSafeResourceUrl } from '../../utils/safeUrl';

/**
 * Facebook-style feed post card: header + body + infographic.
 * @param {{ item: object, now: number, onExpand?: function, isExpandedView?: boolean }} props - API DTO; `now` from useNow for countdown
 */
export default function InterruptionFeedPost({ item, now, onExpand, isExpandedView = false }) {
  const safePosterUrl = item.posterImageUrl ? getSafeResourceUrl(item.posterImageUrl) : null;
  return (
    <article className="interruption-feed-post">
      {/* The Expand Button Trigger for actual advisory posts */}
      {!isExpandedView && onExpand && (
        <button
          type="button"
          className="feed-post-expand-btn"
          title="View full details"
          aria-label="Expand Advisory"
          onClick={onExpand}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      )}
      <InterruptionFeedPostHeader item={item} /> {/* onExpand is handled by the button above, not necessarily needed in header now */}
      <InterruptionFeedPostBody item={item} />
      {safePosterUrl && (
        <div className="feed-post-poster-thumb">
          <a
            href={safePosterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="feed-post-poster-link"
            title="Open poster image"
          >
            <img src={safePosterUrl} alt="Advisory poster image" loading="lazy" />
          </a>
        </div>
      )}
      <InterruptionAdvisoryInfographic item={item} now={now} />
    </article>
  );
}
