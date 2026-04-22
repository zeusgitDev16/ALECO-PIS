import React from 'react';
import {
  getPosterHeadlineText,
  getPosterReasonTextUpper,
  getPosterAffectedAreasGrouped,
  getPosterReferenceDisplay,
} from '../../utils/interruptionPosterFields';
import {
  formatToPhilippineTime,
  formatToPhilippineMonthOnly,
  formatToPhilippineDayNumberRange,
  formatToPhilippineTimeRangeShort,
  formatToPhilippineDayRangeShort,
} from '../../utils/dateUtils';
import { isEmergencyOutageType } from '../../utils/interruptionLabels';
import { getPosterFooterContact } from '../../config/posterPublicEnv';

/**
 * Full-width ALECO-style print layout for Puppeteer capture (not the compact feed infographic).
 * @param {{ item: object }} props
 */
export default function InterruptionAlecoPrintPoster({ item }) {
  const headerText = getPosterHeadlineText(item);
  const refLine = getPosterReferenceDisplay(item.controlNo);
  const monthBadge = formatToPhilippineMonthOnly(item.dateTimeStart);
  const dayNumBadge = formatToPhilippineDayNumberRange(item.dateTimeStart, item.dateTimeEndEstimated);
  const timeBadge = formatToPhilippineTimeRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const dayBadge = formatToPhilippineDayRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const reasonText = getPosterReasonTextUpper(item);
  const feederText = item.feeder || '—';
  const groupedAreas = getPosterAffectedAreasGrouped(item);
  const areas = item.affectedAreas || [];
  const footer = getPosterFooterContact();

  const typeClass = isEmergencyOutageType(item.type)
    ? 'aleco-print-poster--emergency'
    : item.type === 'NgcScheduled'
    ? 'aleco-print-poster--ngcscheduled'
    : 'aleco-print-poster--scheduled';

  return (
    <div className={`aleco-print-poster ${typeClass}`}>
      <div className="aleco-print-poster-frame">

        {/* ── Two-column top: [left: header band + reason + feeder] [right: date card] ── */}
        <div className="aleco-print-poster-top">

          {/* Left column */}
          <div className="aleco-print-poster-col-left">
            <div className="aleco-print-poster-header-band">
              <h1 className="aleco-print-poster-title">{headerText}</h1>
              {refLine && <p className="aleco-print-poster-ref">{refLine}</p>}
            </div>
            <div className="aleco-print-poster-col-left-body">
              <section className="aleco-print-poster-reason">
                <span className="aleco-print-poster-label">REASON:</span>
                <p className="aleco-print-poster-reason-text">{reasonText}</p>
              </section>
              <section className="aleco-print-poster-feeder">
                <span className="aleco-print-poster-label">SUBSTATION/FEEDER:</span>
                <p className="aleco-print-poster-feeder-text">{feederText.toUpperCase()}</p>
              </section>
            </div>
          </div>

          {/* Right column — date card spanning full height of two-column area */}
          <div className="aleco-print-poster-col-right">
            <div className="aleco-print-poster-datecard-inner">
              <div className="aleco-print-poster-datecard-top">
                {monthBadge && <div className="aleco-print-poster-datecard-month">{monthBadge}</div>}
                {dayNumBadge && <div className="aleco-print-poster-datecard-daynum">{dayNumBadge}</div>}
              </div>
              <div className="aleco-print-poster-datecard-bottom">
                {dayBadge && <span className="aleco-print-poster-datecard-day">{dayBadge}</span>}
                {timeBadge && <span className="aleco-print-poster-datecard-time">{timeBadge}</span>}
              </div>
            </div>
          </div>

        </div>

        {/* ── Affected Areas — full width ── */}
        {(groupedAreas.length > 0 || areas.length > 0) && (
          <section className="aleco-print-poster-areas">
            <h2 className="aleco-print-poster-areas-title">AFFECTED AREAS</h2>
            {groupedAreas.length > 0 ? (
              groupedAreas.map((block, bi) => (
                <div key={bi} className="aleco-print-poster-area-block">
                  {block.heading && <h3 className="aleco-print-poster-area-heading">{block.heading}</h3>}
                  <ul>
                    {block.items.map((line, li) => (
                      <li key={`${bi}-${li}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <ul>
                {areas.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </section>
        )}

        {/* ── Disclaimer block ── */}
        <div className="aleco-print-poster-disclaimer-block">
          <p className="aleco-print-poster-disclaimer">{footer.disclaimer}</p>
          {footer.disclaimerBold && (
            <p className="aleco-print-poster-disclaimer-bold">{footer.disclaimerBold}</p>
          )}
          {footer.logoUrl && (
            <img className="aleco-print-poster-logo" src={footer.logoUrl} alt="ALECO" />
          )}
        </div>

        {/* ── Footer contact bar ── */}
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
