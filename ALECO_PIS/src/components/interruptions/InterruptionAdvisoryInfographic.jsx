import React from 'react';
import { getCauseCategoryLabel } from '../../utils/interruptionLabels';
import {
  formatToPhilippineTime,
  formatToPhilippineDateRangeShort,
  formatToPhilippineTimeRangeShort,
  formatToPhilippineDayRangeShort,
} from '../../utils/dateUtils';

/**
 * Structured advisory infographic: header bar, date/time badges, reason/feeder pills, affected areas.
 * @param {{ item: object }} props
 */
export default function InterruptionAdvisoryInfographic({ item }) {
  const type = item.type || 'Unscheduled';
  const headerText = type === 'Scheduled' ? 'SCHEDULED POWER INTERRUPTION' : 'UNSCHEDULED OUTAGE';
  const dateBadge = formatToPhilippineDateRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const timeBadge = formatToPhilippineTimeRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const dayBadge = formatToPhilippineDayRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const reasonText = item.cause || getCauseCategoryLabel(item.causeCategory) || '—';
  const feederText = item.feeder || '—';
  const areas = item.affectedAreas || [];

  return (
    <div className="feed-advisory-infographic">
      <div className="feed-infographic-header-bar">
        <span>{headerText}</span>
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
            <p><strong>Power restored:</strong> <strong>{formatToPhilippineTime(item.dateTimeRestored)}</strong></p>
          )}
        </div>
      )}
      {areas.length > 0 && (
        <div className="feed-infographic-areas">
          <h4 className="feed-infographic-areas-title">AFFECTED AREAS</h4>
          <ul>
            {areas.map((area, i) => (
              <li key={i}>{area}</li>
            ))}
          </ul>
        </div>
      )}
      {item.imageUrl && (
        <div className="feed-infographic-image">
          <img src={item.imageUrl} alt="Advisory" />
        </div>
      )}
    </div>
  );
}
