import React, { useRef, useState, useEffect } from 'react';
import './CSS/BodyLandPage.css';
import './CSS/InterruptionFeed.css';
import { usePublicInterruptions } from './hooks/usePublicInterruptions';
import InterruptionFeedPost from './components/interruptions/InterruptionFeedPost';
import VerticalProgressIndicator from './components/interruptions/VerticalProgressIndicator';
import AsOfDateTracker from './components/interruptions/AsOfDateTracker';

function InterruptionList() {
  const feedRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { interruptions, loading, listUnavailable, refetch } = usePublicInterruptions();

  const bulletinDateFull = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const totalScroll = scrollHeight - clientHeight;
    const progress = totalScroll > 0 ? (scrollTop / totalScroll) * 100 : 0;
    setScrollProgress(progress);
  };

  useEffect(() => {
    handleScroll();
  }, [interruptions, loading, listUnavailable]);

  const hasAdvisoryCards = !loading && !listUnavailable && interruptions.length > 0;

  return (
    <div className="interruption-list-container">
      <h2 className="section-title">Power Outages Updates (Brownout)</h2>

      <div className="feed-controls">
        <VerticalProgressIndicator scrollProgress={scrollProgress} />
        <AsOfDateTracker />
      </div>

      <div
        className="interruption-feed"
        ref={feedRef}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="interruption-card interruption-card--bulletin interruption-card--feed" aria-busy="true">
            <div className="blob blob-pending" aria-hidden />
            <div className="bg">
              <h3 className="status-header status-pending">One moment…</h3>
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
              <h3 className="status-header status-pending">Updates will be back soon</h3>
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

        {!loading && !listUnavailable && interruptions.length === 0 && (
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
              <h3 className="status-header status-restored interruption-good-news-headline">
                No power advisories to report
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
          interruptions.map((item) => (
            <InterruptionFeedPost key={item.id} item={item} />
          ))}
      </div>
    </div>
  );
}

export default InterruptionList;
