import React from 'react';
import {
  getPosterHeadlineText,
  getPosterReasonTextUpper,
  getPosterAffectedAreasGrouped,
  getPosterReferenceDisplay,
} from '../../utils/interruptionPosterFields';
import {
  formatToPhilippineTime,
  formatToPhilippineDateRangeShort,
  formatToPhilippineTimeRangeShort,
  formatToPhilippineDayRangeShort,
} from '../../utils/dateUtils';
import { getPosterFooterContact } from '../../config/posterPublicEnv';

/**
 * Full-width ALECO-style print layout for Puppeteer capture (not the compact feed infographic).
 * @param {{ item: object }} props
 */
export default function InterruptionAlecoPrintPoster({ item }) {
  const headerText = getPosterHeadlineText(item);
  const refLine = getPosterReferenceDisplay(item.controlNo);
  const dateBadge = formatToPhilippineDateRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const timeBadge = formatToPhilippineTimeRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const dayBadge = formatToPhilippineDayRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const reasonText = getPosterReasonTextUpper(item);
  const feederText = item.feeder || '—';
  const groupedAreas = getPosterAffectedAreasGrouped(item);
  const areas = item.affectedAreas || [];
  const footer = getPosterFooterContact();

  return (
    <div className="aleco-print-poster">
      <div className="aleco-print-poster-frame">
        <header className="aleco-print-poster-header">
          <div className="aleco-print-poster-header-main">
            <h1 className="aleco-print-poster-title">{headerText}</h1>
            {refLine ? <p className="aleco-print-poster-ref">{refLine}</p> : null}
          </div>
          <div className="aleco-print-poster-datecard">
            <div className="aleco-print-poster-datecard-inner">
              {dateBadge ? <div className="aleco-print-poster-datecard-line1">{dateBadge}</div> : null}
              {(dayBadge || timeBadge) ? (
                <div className="aleco-print-poster-datecard-line2">
                  {[dayBadge, timeBadge].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="aleco-print-poster-reason">
          <span className="aleco-print-poster-label">REASON:</span>
          <p className="aleco-print-poster-reason-text">{reasonText}</p>
        </section>

        <section className="aleco-print-poster-feeder">
          <span className="aleco-print-poster-label">SUBSTATION/FEEDER:</span>
          <p className="aleco-print-poster-feeder-text">{feederText.toUpperCase()}</p>
        </section>

        <section className="aleco-print-poster-schedule">
          {item.dateTimeStart && (
            <p>
              <strong>Outage start:</strong> {formatToPhilippineTime(item.dateTimeStart)}
            </p>
          )}
          {item.dateTimeEndEstimated && (
            <p>
              <strong>Estimated restoration:</strong> {formatToPhilippineTime(item.dateTimeEndEstimated)}
            </p>
          )}
          {item.dateTimeRestored && (
            <p>
              <strong>Energized:</strong> {formatToPhilippineTime(item.dateTimeRestored)}
            </p>
          )}
        </section>

        {(groupedAreas.length > 0 || areas.length > 0) && (
          <section className="aleco-print-poster-areas">
            <h2 className="aleco-print-poster-areas-title">AFFECTED AREAS</h2>
            {groupedAreas.length > 0 ? (
              groupedAreas.map((block, bi) => (
                <div key={bi} className="aleco-print-poster-area-block">
                  {block.heading ? <h3 className="aleco-print-poster-area-heading">{block.heading}</h3> : null}
                  <ul>
                    {block.items.map((line, li) => (
                      <li key={`${bi}-${li}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <ul>
                {areas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <p className="aleco-print-poster-disclaimer">{footer.disclaimer}</p>

        <footer className="aleco-print-poster-footer">
          <span>{footer.facebook}</span>
          <span>{footer.email}</span>
          <span>{footer.smart}</span>
          <span>{footer.globe}</span>
        </footer>
      </div>
    </div>
  );
}
