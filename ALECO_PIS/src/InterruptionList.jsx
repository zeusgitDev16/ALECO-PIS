import React, { useRef, useState, useEffect, useMemo } from 'react';
import { formatPhilippineNow } from './utils/dateUtils';
import './CSS/BodyLandPage.css';
import './CSS/InterruptionFeed.css';
import { usePublicInterruptions } from './hooks/usePublicInterruptions';
import { useNow } from './hooks/useNow';
import { RESOLVED_DISPLAY_MS } from './constants/interruptionConstants';
import InterruptionFeedPost from './components/interruptions/InterruptionFeedPost';
import VerticalProgressIndicator from './components/interruptions/VerticalProgressIndicator';
import AsOfDateTracker from './components/interruptions/AsOfDateTracker';

/** True if a Resolved advisory should be hidden (past the display window). */
function isResolvedPastDisplayWindow(item, now) {
  if (item?.status !== 'Restored') return false;
  const restored = item?.dateTimeRestored ? new Date(item.dateTimeRestored).getTime() : 0;
  if (!restored) return false;
  const cutoff = restored + RESOLVED_DISPLAY_MS;
  return now >= cutoff;
}

function InterruptionList() {
  const feedRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [expandedItem, setExpandedItem] = useState(null); // State to hold the item to expand
  const { interruptions, loading, listUnavailable, refetch } = usePublicInterruptions();
  const upcomingItems = useMemo(
    () => interruptions.filter((i) => i.status === 'Pending'),
    [interruptions]
  );
  const now = useNow(upcomingItems);

  /** Exclude archived (deletedAt) and Resolved advisories past 36h display window. */
  const visibleInterruptions = useMemo(() => {
    return interruptions.filter((i) => {
      if (i?.deletedAt) return false;
      if (isResolvedPastDisplayWindow(i, now)) return false;
      return true;
    });
  }, [interruptions, now]);

  // Memoize date calculation so it only runs when we actually need to show the empty state
  const bulletinDateFull = useMemo(() => {
    if (!loading && !listUnavailable && visibleInterruptions.length === 0) {
      return formatPhilippineNow({ weekday: true, month: true, day: true, year: true });
    }
    return '';
  }, [loading, listUnavailable, visibleInterruptions.length]);

  // Constants for scroll amount
  const CARD_WIDTH = 380;
  const CARD_GAP = 32;

  const handleScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const totalScroll = scrollWidth - clientWidth;
    const progress = totalScroll > 0 ? (scrollLeft / totalScroll) * 100 : 0;
    setScrollProgress(progress);
  };

  const scroll = (direction) => {
    const el = feedRef.current;
    if (!el) return;
    const scrollAmount = CARD_WIDTH + CARD_GAP;
    const amount = direction === 'left' ? -scrollAmount : scrollAmount;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleExpand = (item) => {
    setExpandedItem(item);
    document.body.style.overflow = 'hidden'; // Prevent body scroll when modal is open
  };

  const handleCloseExpand = () => {
    setExpandedItem(null);
    document.body.style.overflow = 'unset'; // Restore body scroll
  };

  useEffect(() => {
    handleScroll();
  }, [visibleInterruptions, loading, listUnavailable]);

  const hasAdvisoryCards = !loading && !listUnavailable && visibleInterruptions.length > 0;

  return (
    <div className="interruption-list-container">
      <h2 className="section-title">Power Outages Updates (Brownout)</h2>

      <div
        className="interruption-feed"
        ref={feedRef}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="interruption-card interruption-card--bulletin interruption-card--feed" aria-busy="true">
            <div className="blob blob-pending" aria-hidden />
            <div className="bg">
              <h3 className="status-header status-pending" style={{ position: 'relative' }}>
                One moment…
                <button
                  type="button"
                  className="feed-post-expand-btn"
                  title="Expand"
                  aria-label="Expand"
                  onClick={() => handleExpand({ type: 'loading' })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </button>
              </h3>
              <div className="card-details card-details--bulletin">
                <p>We&apos;re checking for the latest brownout updates from ALECO.</p>
              </div>
            </div>
          </div>
        )}

        {!loading && listUnavailable && (
          <div className="interruption-card interruption-card--bulletin interruption-card--feed" role="status">
            <div className="blob blob-pending" aria-hidden />
            <div className="bg">
              <h3 className="status-header status-pending" style={{ position: 'relative' }}>
                Updates will be back soon
                <button
                  type="button"
                  className="feed-post-expand-btn"
                  title="Expand"
                  aria-label="Expand"
                  onClick={() => handleExpand({ type: 'unavailable' })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </button>
              </h3>
              <div className="card-details card-details--bulletin">
                <p>
                  We can&apos;t show the outage bulletin right now. This doesn&apos;t mean your power is
                  out—only this page needs a quick refresh.
                </p>
                <button type="button" className="interruption-bulletin-btn" onClick={() => refetch()}>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !listUnavailable && visibleInterruptions.length === 0 && (
          <div className="interruption-card interruption-card--bulletin interruption-card--good-news interruption-card--feed">
            <div className="blob blob-restored" aria-hidden />
            <div className="bg interruption-good-news-inner">
              <div className="interruption-good-news-icon" aria-hidden>
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
                  <path
                    d="M14 24.5l7 7 13-16"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="interruption-good-news-badge">Good news</span>
              <h3 className="status-header status-restored interruption-good-news-headline" style={{ position: 'relative' }}>
                No power advisories to report
                <button
                  type="button"
                  className="feed-post-expand-btn"
                  title="View Bulletin Details"
                  onClick={() => handleExpand({ type: 'good-news' })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
              </h3>
              <p className="interruption-good-news-date">{bulletinDateFull}</p>
              <div className="card-details card-details--bulletin card-details--good-news">
                <p className="interruption-good-news-lead">
                  <strong>This board shares brownouts and planned outages</strong>—so when you see cards here,
                  it means there is something the cooperative wants customers to know.{' '}
                  <strong>Right now there are no new posts, and that&apos;s a good thing.</strong>
                </p>
                <p className="interruption-good-news-body">
                  ALECO will publish advisories here whenever there&apos;s scheduled work or widespread
                  interruptions worth announcing. Your lights might still flicker for other reasons—if you need
                  help, we&apos;re still here for you.
                </p>
                <p className="interruption-good-news-help">
                  Questions or an outage at home? Use <strong>Report a Problem</strong> or call{' '}
                  <strong>ALECO</strong> so they can assist you directly.
                </p>
                <p className="interruption-bulletin-enjoy">Enjoy your day!</p>
              </div>
            </div>
          </div>
        )}

        {hasAdvisoryCards &&
          visibleInterruptions.map((item) => (
            <InterruptionFeedPost
              key={item.id}
              item={item}
              now={now}
              onExpand={() => handleExpand(item)} // Pass the item to the expand handler
            />
          ))}
      </div>

      <div className="feed-controls">
        <VerticalProgressIndicator scrollProgress={scrollProgress} />
        {hasAdvisoryCards && (
          <div className="feed-nav-buttons-bottom">
            <button
              type="button"
              className="feed-nav-btn-bottom"
              onClick={() => scroll('left')}
              aria-label="Scroll feed left"
            >
              ‹
            </button>
            <button
              type="button"
              className="feed-nav-btn-bottom"
              onClick={() => scroll('right')}
              aria-label="Scroll feed right"
            >
              ›
            </button>
          </div>
        )}
        <AsOfDateTracker />
      </div>

      <hr className="section-separator" aria-hidden="true" />

      {/* --- Full Card Expansion Modal --- */}
      {expandedItem && (
        <div className="interruption-modal-overlay" onClick={handleCloseExpand}>
          <div className="interruption-modal-container" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="interruption-modal-close-btn"
              onClick={handleCloseExpand}
              aria-label="Close"
            >
              &times;
            </button>

            {/* 1. Expansion for Data-driven Post (Standard Advisories) */}
            {expandedItem.id && (
              <InterruptionFeedPost
                item={expandedItem}
                now={now}
                isExpandedView={true} // Indicate that this is an expanded view
              />
            )}

            {/* 2. Expansion for Loading State */}
            {expandedItem.type === 'loading' && (
              <div className="interruption-card interruption-card--bulletin interruption-card--feed">
                <div className="blob blob-pending" aria-hidden />
                <div className="bg">
                  <h3 className="status-header status-pending">Checking for updates...</h3>
                  <div className="card-details card-details--bulletin">
                    <p>We are currently fetching the latest power interruption advisories from the ALECO system. Please wait a moment.</p>
                    <p>This automated board updates in real-time as soon as technical teams publish new information.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Expansion for Unavailable State */}
            {expandedItem.type === 'unavailable' && (
              <div className="interruption-card interruption-card--bulletin interruption-card--feed">
                <div className="blob blob-pending" aria-hidden />
                <div className="bg">
                  <h3 className="status-header status-pending">Updates Unavailable</h3>
                  <div className="card-details card-details--bulletin">
                    <p>The system is currently unable to sync with the advisory database. This may be due to a temporary network interruption.</p>
                    <button type="button" className="interruption-bulletin-btn" onClick={() => { handleCloseExpand(); refetch(); }}>
                      Retry Connection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Expansion for Good News State */}
            {expandedItem.type === 'good-news' && (
              <div className="interruption-card interruption-card--bulletin interruption-card--good-news interruption-card--feed">
                <div className="blob blob-restored" aria-hidden />
                <div className="bg interruption-good-news-inner">
                  <div className="interruption-good-news-icon" aria-hidden>
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
                      <path d="M14 24.5l7 7 13-16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="interruption-good-news-badge">Status Report</span>
                  <h3 className="status-header status-restored interruption-good-news-headline">
                    Grid Status: Stable
                  </h3>
                  <p className="interruption-good-news-date">{bulletinDateFull}</p>
                  <div className="card-details card-details--bulletin card-details--good-news">
                    <p className="interruption-good-news-lead">
                      <strong>There are no scheduled work or reported wide-area outages at this time.</strong>
                    </p>
                    <p className="interruption-good-news-body">
                      This board serves as the official announcement channel for planned maintenance, emergency repairs, and large-scale power restorations.
                      If your area is experiencing a localized outage not listed here, it might be due to a specific circuit issue.
                    </p>
                    <p className="interruption-good-news-help">
                      Are you experiencing an outage? Please use our <strong>Report a Problem</strong> tool or contact the <strong>ALECO Hotline</strong> directly so technical crews can assist you.
                    </p>
                    <p className="interruption-bulletin-enjoy" style={{ fontSize: '1.2rem' }}>All Systems Normal</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InterruptionList;
