import React, { useRef, useState, useEffect, useCallback } from 'react';
import './CSS/BodyLandPage.css';
import { apiUrl } from './utils/api';

function InterruptionList() {
  const sliderRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [interruptions, setInterruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const date = new Date();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  const loadInterruptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/interruptions?limit=50'));
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error(json.message || 'Could not load power advisories.');
      }
      setInterruptions(json.data);
    } catch (e) {
      setError(e.message || 'Failed to load interruptions.');
      setInterruptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterruptions();
  }, [loadInterruptions]);

  const scroll = (direction) => {
    if (sliderRef.current) {
      const { current } = sliderRef;
      const scrollAmount = 300;
      if (direction === 'left') {
        current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const handleScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      const totalScroll = scrollWidth - clientWidth;
      const currentProgress = totalScroll > 0 ? (scrollLeft / totalScroll) * 100 : 0;
      setScrollProgress(currentProgress);
    }
  };

  useEffect(() => {
    handleScroll();
  }, [interruptions, loading]);

  return (
    <div className="interruption-list-container">
      <h2 className="section-title">Power Outages Updates (Brownout)</h2>

      {loading && (
        <p className="widget-text" style={{ textAlign: 'center', margin: '1rem 0' }}>
          Loading advisories…
        </p>
      )}
      {error && !loading && (
        <p className="widget-text" style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--error, #c00)' }}>
          {error}{' '}
          <button type="button" className="nav-btn" onClick={loadInterruptions} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </p>
      )}

      <div
        className="interruption-slider"
        ref={sliderRef}
        onScroll={handleScroll}
      >
        {!loading && !error && interruptions.length === 0 && (
          <div className="interruption-card" style={{ minWidth: 280, opacity: 0.95 }}>
            <div className="bg">
              <h3 className="status-header">No active listings</h3>
              <div className="card-details">
                <p>There are no power interruption advisories published at this time.</p>
              </div>
            </div>
          </div>
        )}
        {interruptions.map((item) => (
          <div key={item.id} className="interruption-card">
            <div className={`blob blob-${String(item.status).toLowerCase()}`}></div>
            <div className="bg">
              <h3 className={`status-header status-${String(item.status).toLowerCase()}`}>
                {item.status} - {item.type}
              </h3>
              <div className="card-details">
                <p><strong>Feeder:</strong> {item.feeder}</p>
                <p><strong>Affected Areas:</strong> {(item.affectedAreas || []).join(', ')}</p>
                <p><strong>Cause:</strong> {item.cause}</p>
                <p><strong>Start:</strong> {item.dateTimeStart}</p>
                {item.dateTimeEndEstimated && (
                  <p><strong>Est. End:</strong> {item.dateTimeEndEstimated}</p>
                )}
                {item.dateTimeRestored && (
                  <p><strong>Restored:</strong> {item.dateTimeRestored}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="date-tracker">
        As of {month}, {year}!
      </p>

      <div className="slider-controls">
        <div className="progress-track">
          <div
            className="progress-indicator"
            style={{ width: `${Math.max(scrollProgress, 10)}%` }}
          ></div>
        </div>

        <div className="nav-buttons">
          <button type="button" className="nav-btn" onClick={() => scroll('left')}>←</button>
          <button type="button" className="nav-btn" onClick={() => scroll('right')}>→</button>
        </div>
      </div>
    </div>
  );
}

export default InterruptionList;
