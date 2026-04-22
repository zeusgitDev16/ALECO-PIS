import React from 'react';
import {
  getPosterHeadlineText,
  getPosterReasonText,
  getPosterTimeRangeDisplay,
  getPosterReferenceDisplay,
  getPosterAffectedAreasFlat,
  getPosterAffectedAreasGrouped,
} from '../../utils/interruptionPosterFields';
import { getStatusDisplayLabel } from '../../utils/interruptionLabels';
import { formatToPhilippineTime } from '../../utils/dateUtils';

/**
 * Read-only aggregation of poster-facing fields (low-fidelity; no pixel poster art).
 * @param {{ dto: object }} props - API-shaped or `formStateToPosterPreviewDto` object
 */
export default function InterruptionPosterAlignmentPreview({ dto }) {
  if (!dto) return null;

  const refLine = getPosterReferenceDisplay(dto.controlNo);
  const reason = getPosterReasonText(dto);
  const timeRange = getPosterTimeRangeDisplay(dto.dateTimeStart, dto.dateTimeEndEstimated);
  const flat = getPosterAffectedAreasFlat(dto);
  const grouped = getPosterAffectedAreasGrouped(dto);
  const statusLabel = dto.status ? getStatusDisplayLabel(dto.status) : '—';
  const missingControl = !dto.controlNo || !String(dto.controlNo).trim();

  return (
    <div className="interruptions-poster-alignment-preview" role="region" aria-label="Poster fields preview">
      {missingControl && (
        <p className="interruptions-poster-alignment-preview-warn" role="status">
          Reference (control #) is empty — poster header may look incomplete.
        </p>
      )}
      {dto.type === 'NgcScheduled' && (
        <p className="interruptions-poster-alignment-preview-note" role="note">
          <strong>NGCP layout:</strong> Use the advisory <strong>body</strong> for letter-style text, tables, and extra
          detail. Quick fields drive the banner; rich NGCP content stays in the post body (strategy 4A — see{' '}
          <span className="interruptions-poster-alignment-preview-docref">docs/ADMIN_INTERRUPTIONS_POSTER_FIELD_GAP.md</span>
          ).
        </p>
      )}
      <dl className="interruptions-poster-alignment-preview-dl">
        <div>
          <dt>Headline</dt>
          <dd>{getPosterHeadlineText(dto)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{refLine || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Feeder</dt>
          <dd>{dto.feeder && String(dto.feeder).trim() ? String(dto.feeder).trim() : '—'}</dd>
        </div>
        <div>
          <dt>Time range (poster)</dt>
          <dd>{timeRange || '—'}</dd>
        </div>
        <div>
          <dt>Start (full)</dt>
          <dd>{dto.dateTimeStart ? formatToPhilippineTime(dto.dateTimeStart) : '—'}</dd>
        </div>
        <div>
          <dt>ERT (full)</dt>
          <dd>{dto.dateTimeEndEstimated ? formatToPhilippineTime(dto.dateTimeEndEstimated) : '—'}</dd>
        </div>
        <div>
          <dt>REASON (poster)</dt>
          <dd>{reason || '—'}</dd>
        </div>
      </dl>
      <div className="interruptions-poster-alignment-preview-areas">
        <h5 className="interruptions-poster-alignment-preview-subtitle">Affected areas (poster)</h5>
        {grouped.length > 0 ? (
          <ul className="interruptions-poster-alignment-preview-grouped">
            {grouped.map((block, bi) => (
              <li key={bi}>
                {block.heading ? <strong>{block.heading}</strong> : <em>(no heading)</em>}
                {block.items.length > 0 ? (
                  <ul>
                    {block.items.map((line, li) => (
                      <li key={li}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="interruptions-poster-alignment-preview-empty">No bullets in this section.</p>
                )}
              </li>
            ))}
          </ul>
        ) : flat.length > 0 ? (
          <ul>
            {flat.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="interruptions-poster-alignment-preview-empty">—</p>
        )}
      </div>
    </div>
  );
}
