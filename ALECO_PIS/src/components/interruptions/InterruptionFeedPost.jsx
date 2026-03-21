import React from 'react';
import InterruptionFeedPostHeader from './InterruptionFeedPostHeader';
import InterruptionFeedPostBody from './InterruptionFeedPostBody';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';

/**
 * Facebook-style feed post card: header + body + infographic.
 * @param {{ item: object, now?: number }} props - API DTO, now for countdown refresh only
 */
export default function InterruptionFeedPost({ item, now = Date.now() }) {
  return (
    <article className="interruption-feed-post">
      <InterruptionFeedPostHeader item={item} />
      <InterruptionFeedPostBody item={item} />
      <InterruptionAdvisoryInfographic item={item} now={now} />
    </article>
  );
}
