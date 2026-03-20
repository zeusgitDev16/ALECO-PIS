import React from 'react';

/**
 * Horizontal progress bar bound to vertical scroll (0% = top, 100% = bottom).
 * @param {{ scrollProgress: number }} props - 0 to 100
 */
export default function VerticalProgressIndicator({ scrollProgress }) {
  const percent = Math.min(100, Math.max(0, Number(scrollProgress) || 0));
  return (
    <div className="feed-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="feed-progress-indicator"
        style={{ width: `${Math.max(percent, 2)}%` }}
      />
    </div>
  );
}
