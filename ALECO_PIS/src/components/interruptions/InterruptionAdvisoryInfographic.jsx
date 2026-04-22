import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getPosterHeadlineText,
  getPosterReasonTextUpper,
  getPosterAffectedAreasGrouped,
} from '../../utils/interruptionPosterFields';
import {
  formatToPhilippineTime,
  formatToPhilippineDateRangeShort,
  formatToPhilippineTimeRangeShort,
  formatToPhilippineDayRangeShort,
} from '../../utils/dateUtils';
import { getCountdownToStart } from '../../utils/interruptionStatusUtils';
import { getSafeResourceUrl } from '../../utils/safeUrl';

/**
 * Structured advisory infographic: header bar, date/time badges, reason/feeder pills, affected areas.
 * Shows "Starts in Xh Xm" countdown when advisory is upcoming.
 * @param {{ item: object, now?: number }} props
 */
export default function InterruptionAdvisoryInfographic({ item, now = Date.now() }) {
  const headerText = getPosterHeadlineText(item);
  const countdown = getCountdownToStart(item, now);
  const dateBadge = formatToPhilippineDateRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const timeBadge = formatToPhilippineTimeRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const dayBadge = formatToPhilippineDayRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const reasonText = getPosterReasonTextUpper(item);
  const feederText = item.feeder || '—';
  const areas = item.affectedAreas || [];
  const groupedAreas = getPosterAffectedAreasGrouped(item);
  const [showFullImage, setShowFullImage] = useState(false);
  const safeAdvisoryImageUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;

  return (
    <div className="feed-advisory-infographic">
      <div className="feed-infographic-header-bar">
        <span>{headerText}</span>
        {countdown && (
          <span className="feed-infographic-countdown" role="status">
            <strong>Starts in</strong> {countdown.hours > 0 ? `${countdown.hours}h ` : ''}{countdown.minutes}m
          </span>
        )}
        <div className="feed-infographic-badges">
          {dateBadge && <span className="feed-infographic-date-badge">{dateBadge}</span>}
          {(dayBadge || timeBadge) && (
            <span className="feed-infographic-time-badge">
              {dayBadge && timeBadge ? `${dayBadge} ${timeBadge}` : dayBadge || timeBadge}
            </span>
          )}
        </div>
      </div>
      <div className="feed-infographic-pills">
        <span className="feed-infographic-pill feed-infographic-pill--reason">
          REASON: {reasonText.toUpperCase()}
        </span>
        <span className="feed-infographic-pill feed-infographic-pill--feeder">
          SUBSTATION/FEEDER: {feederText.toUpperCase()}
        </span>
      </div>
      {(item.dateTimeStart || item.dateTimeEndEstimated || item.dateTimeRestored) && (
        <div className="feed-infographic-schedule">
          {item.dateTimeStart && (
            <p><strong>Outage start:</strong> <strong>{formatToPhilippineTime(item.dateTimeStart)}</strong></p>
          )}
          {item.dateTimeEndEstimated && (
            <p><strong>Estimated restoration:</strong> <strong>{formatToPhilippineTime(item.dateTimeEndEstimated)}</strong></p>
          )}
          {item.dateTimeRestored && (
            <p><strong>Energized:</strong> <strong>{formatToPhilippineTime(item.dateTimeRestored)}</strong></p>
          )}
        </div>
      )}
      {(groupedAreas.length > 0 || areas.length > 0) && (
        <div className="feed-infographic-areas">
          <h4 className="feed-infographic-areas-title">AFFECTED AREAS</h4>
          {groupedAreas.length > 0 ? (
            groupedAreas.map((block, bi) => (
              <div key={bi} className="feed-infographic-area-block">
                {block.heading ? (
                  <p className="feed-infographic-area-heading">{block.heading}</p>
                ) : null}
                <ul>
                  {block.items.map((area, i) => (
                    <li key={`${bi}-${i}`}>{area}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <ul>
              {areas.map((area, i) => (
                <li key={i}>{area}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {safeAdvisoryImageUrl && (
        <>
          <div 
            className="feed-infographic-image" 
            onClick={() => setShowFullImage(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowFullImage(true)}
          >
            <img src={safeAdvisoryImageUrl} alt="Advisory" />
          </div>

          {showFullImage && createPortal(
            <div 
              className="full-screen-image-overlay" 
              onClick={() => setShowFullImage(false)}
            >
              <img src={safeAdvisoryImageUrl} alt="Full advisory view" />
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
