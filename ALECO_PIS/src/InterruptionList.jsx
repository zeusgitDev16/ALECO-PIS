import React, { useRef, useState, useEffect } from 'react';
import './CSS/BodyLandPage.css';

function InterruptionList() {
  const sliderRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Get Current Date
  const date = new Date();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  // Sample Data
  const interruptions = [
    {
      id: 1,
      type: "Unscheduled",
      status: "Ongoing",
      affectedAreas: ["Legazpi City", "Daraga"],
      feeder: "Feeder 5",
      cause: "Line fault due to heavy rains",
      dateTimeStart: "2023-10-27 14:00",
      dateTimeEndEstimated: "2023-10-27 18:00",
      dateTimeRestored: null
    },
    {
      id: 2,
      type: "Scheduled",
      status: "Pending",
      affectedAreas: ["Tabaco City"],
      feeder: "Feeder 1",
      cause: "Maintenance of substation",
      dateTimeStart: "2023-10-28 08:00",
      dateTimeEndEstimated: "2023-10-28 17:00",
      dateTimeRestored: null
    },
    {
      id: 3,
      type: "Unscheduled",
      status: "Restored",
      affectedAreas: ["Guinobatan"],
      feeder: "Feeder 3",
      cause: "Tripped line",
      dateTimeStart: "2023-10-26 10:00",
      dateTimeEndEstimated: null,
      dateTimeRestored: "2023-10-26 11:30"
    },
    {
        id: 4,
        type: "Scheduled",
        status: "Pending",
        affectedAreas: ["Camalig"],
        feeder: "Feeder 2",
        cause: "Pole replacement",
        dateTimeStart: "2023-10-29 09:00",
        dateTimeEndEstimated: "2023-10-29 13:00",
        dateTimeRestored: null
    },
  ];

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
      const currentProgress = (scrollLeft / totalScroll) * 100;
      setScrollProgress(currentProgress);
    }
  };
  
  useEffect(() => {
    handleScroll();
  }, []);

  return (
    <div className="interruption-list-container">
      <h2 className="section-title">Power Outages Updates (Brownout)</h2>

      {/* The Scrollable Horizontal Container */}
      <div 
        className="interruption-slider" 
        ref={sliderRef} 
        onScroll={handleScroll}
      >
        {interruptions.map((item) => (
          <div key={item.id} className="interruption-card">
            <div className={`blob blob-${item.status.toLowerCase()}`}></div>
            <div className="bg">
              <h3 className={`status-header status-${item.status.toLowerCase()}`}>
                {item.status} - {item.type}
              </h3>
              <div className="card-details">
                <p><strong>Feeder:</strong> {item.feeder}</p>
                <p><strong>Affected Areas:</strong> {item.affectedAreas.join(", ")}</p>
                <p><strong>Cause:</strong> {item.cause}</p>
                <p><strong>Start:</strong> {item.dateTimeStart}</p>
                {item.dateTimeEndEstimated && <p><strong>Est. End:</strong> {item.dateTimeEndEstimated}</p>}
                {item.dateTimeRestored && <p><strong>Restored:</strong> {item.dateTimeRestored}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- NEW: Date Tracker --- */}
      <p className="date-tracker">
        As of {month}, {year}!
      </p>

      {/* Controls: Progress Bar + Buttons */}
      <div className="slider-controls">
        <div className="progress-track">
            <div 
                className="progress-indicator" 
                style={{ width: `${Math.max(scrollProgress, 10)}%` }} 
            ></div>
        </div>

        <div className="nav-buttons">
            <button className="nav-btn" onClick={() => scroll('left')}>←</button>
            <button className="nav-btn" onClick={() => scroll('right')}>→</button>
        </div>
      </div>
    </div>
  );
}

export default InterruptionList;