import React from 'react';

/**
 * "As of {month}, {year}!" date tracker for the feed.
 */
export default function AsOfDateTracker() {
  const date = new Date();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return (
    <p className="feed-date-tracker">
      As of {month}, {year}!
    </p>
  );
}
