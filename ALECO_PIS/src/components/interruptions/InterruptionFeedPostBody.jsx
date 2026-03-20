import React from 'react';
import { getCauseCategoryLabel } from '../../utils/interruptionLabels';

/** Labels that get bold value when parsing template-style body */
const BOLD_VALUE_LABELS = ['Date:', 'Time:', 'Affected Areas:', 'Reason:'];

/**
 * Parse a line like "Label: value" and return { label, value } or null.
 */
function parseLabelValue(line) {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const label = line.slice(0, colonIdx + 1).trim();
  const value = line.slice(colonIdx + 1).trim();
  return { label, value };
}

/**
 * Render template-style body with bold labels and values (Date, Time, etc.) and ADDITIONAL DETAILS section.
 */
function renderTemplateBody(bodyText) {
  const lines = bodyText.split('\n');
  const elements = [];
  let inAdditionalDetails = false;
  let additionalLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.toUpperCase() === 'ADDITIONAL DETAILS:') {
      inAdditionalDetails = true;
      continue;
    }

    if (inAdditionalDetails) {
      additionalLines.push(line);
      continue;
    }

    const parsed = parseLabelValue(line);
    if (parsed && BOLD_VALUE_LABELS.some((l) => parsed.label.toLowerCase() === l.toLowerCase())) {
      elements.push(
        <p key={i} className="feed-post-template-line">
          <strong>{parsed.label}</strong> <strong>{parsed.value || '—'}</strong>
        </p>
      );
    } else if (trimmed) {
      elements.push(
        <p key={i} className="feed-post-template-line" style={{ whiteSpace: 'pre-wrap' }}>
          {line}
        </p>
      );
    } else if (line === '' && elements.length > 0) {
      elements.push(<br key={`br-${i}`} />);
    }
  }

  if (inAdditionalDetails && additionalLines.length) {
    const content = additionalLines.join('\n').trim();
    if (content) {
      elements.push(
        <div key="add-final" className="feed-post-additional-details">
          <p className="feed-post-additional-title"><strong>ADDITIONAL DETAILS:</strong></p>
          <div className="feed-post-additional-content" style={{ whiteSpace: 'pre-wrap' }}>
            {content}
          </div>
        </div>
      );
    }
  }

  return elements;
}

/**
 * Facebook-style post body: headline, free-form text, or legacy structured fields.
 * @param {{ item: object, getCauseCategoryLabel?: (v: string) => string }} props
 */
export default function InterruptionFeedPostBody({ item }) {
  const hasBody = item.body && String(item.body).trim();

  if (hasBody) {
    const bodyText = item.body.trim();
    const lines = bodyText.split('\n');
    const firstLine = lines[0] || bodyText;
    const headline = firstLine.length > 100 ? firstLine.slice(0, 100) + '…' : firstLine;

    const hasTemplateStructure = BOLD_VALUE_LABELS.some((l) =>
      firstLine.startsWith(l) || firstLine.toLowerCase().startsWith(l.toLowerCase())
    );
    const hasAdditionalDetails = bodyText.toUpperCase().includes('ADDITIONAL DETAILS:');

    const useTemplateRendering = hasTemplateStructure || hasAdditionalDetails;

    return (
      <div className="feed-post-body">
        {!useTemplateRendering && (
          <p className="feed-post-headline">{headline.toUpperCase()}</p>
        )}
        {useTemplateRendering ? (
          <div className="feed-post-body-text feed-post-body-text--template">
            {renderTemplateBody(bodyText)}
          </div>
        ) : (
          <>
            {lines.length > 1 && (
              <div className="feed-post-body-text" style={{ whiteSpace: 'pre-wrap' }}>
                {lines.slice(1).join('\n').trim()}
              </div>
            )}
          </>
        )}
        {item.controlNo && (
          <p className="feed-post-control-no">
            <strong>Control #:</strong> <strong>{item.controlNo}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="feed-post-body feed-post-body--legacy">
      <p>
        <strong>Feeder:</strong> {item.feeder || '—'}
      </p>
      <p>
        <strong>Affected Areas:</strong> {(item.affectedAreas || []).join(', ') || '—'}
      </p>
      <p>
        <strong>Cause:</strong> {item.cause || '—'}
      </p>
      {item.causeCategory && (
        <p>
          <strong>Category:</strong> {getCauseCategoryLabel(item.causeCategory)}
        </p>
      )}
    </div>
  );
}
