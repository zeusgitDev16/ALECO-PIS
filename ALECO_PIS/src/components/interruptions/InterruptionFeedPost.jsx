import React from 'react';
import InterruptionFeedPostHeader from './InterruptionFeedPostHeader';
import InterruptionFeedPostBody from './InterruptionFeedPostBody';
import InterruptionAdvisoryInfographic from './InterruptionAdvisoryInfographic';

/**
 * Facebook-style feed post card: header + body + infographic.
 * @param {{ item: object }} props - API DTO
 */
export default function InterruptionFeedPost({ item }) {
  return (
    <article className="interruption-feed-post">
      <InterruptionFeedPostHeader item={item} />
      <InterruptionFeedPostBody item={item} />
      <InterruptionAdvisoryInfographic item={item} />
    </article>
  );
}
