import React from 'react';
import { formatPhilippineNow } from '../../utils/dateUtils';

/**
 * "As of {month}, {year}!" date tracker for the feed (Philippine time).
 */
export default function AsOfDateTracker() {
  const dateStr = formatPhilippineNow({ month: true, year: true });
  return (
    <p className="feed-date-tracker">
      As of {dateStr}!
    </p>
  );
}
