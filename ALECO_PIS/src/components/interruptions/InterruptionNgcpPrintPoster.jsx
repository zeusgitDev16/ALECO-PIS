import React from 'react';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import {
  formatToPhilippineMonthOnly,
  formatToPhilippineDayNumberRange,
  formatToPhilippineDayRangeShort,
  formatToPhilippineTimeRangeShort,
} from '../../utils/dateUtils';
import { getPosterHeadlineText, getPosterReferenceDisplay } from '../../utils/interruptionPosterFields';
import { getPosterFooterContact } from '../../config/posterPublicEnv';

/**
 * NGCP scheduled print poster layout.
 * Embeds the uploaded NGCP letter image in a centered document frame.
 * @param {{ item: object }} props
 */
export default function InterruptionNgcpPrintPoster({ item }) {
  const title = getPosterHeadlineText(item);
  const refLine = getPosterReferenceDisplay(item.controlNo);
  const month = formatToPhilippineMonthOnly(item.dateTimeStart);
  const dayNum = formatToPhilippineDayNumberRange(item.dateTimeStart, item.dateTimeEndEstimated);
  const day = formatToPhilippineDayRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const time = formatToPhilippineTimeRangeShort(item.dateTimeStart, item.dateTimeEndEstimated);
  const safeAttachmentUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;
  const footer = getPosterFooterContact();

  return (
    <div className="aleco-print-poster ngcp-print-poster">
      <div className="ngcp-print-poster-frame">
        <header className="ngcp-print-poster-head">
          <div className="ngcp-print-poster-head-main">
            <h1 className="ngcp-print-poster-title">{title}</h1>
            {refLine ? <p className="ngcp-print-poster-ref">{refLine}</p> : null}
          </div>
          <div className="ngcp-print-poster-date-card">
            {month ? <div className="ngcp-print-poster-date-month">{month}</div> : null}
            {dayNum ? (
              <div
                className={`ngcp-print-poster-date-num${dayNum.includes('-') ? ' ngcp-print-poster-date-num--range' : ''}`}
              >
                {dayNum}
              </div>
            ) : null}
            {day ? <div className="ngcp-print-poster-date-day">{day}</div> : null}
            {time ? <div className="ngcp-print-poster-date-time">{time}</div> : null}
          </div>
        </header>

        <section className="ngcp-print-poster-body">
          <div className="ngcp-print-poster-doc-frame">
            {safeAttachmentUrl ? (
              <img
                src={safeAttachmentUrl}
                alt="NGCP source document"
                className="ngcp-print-poster-doc-image"
              />
            ) : (
              <div className="ngcp-print-poster-doc-empty">
                <p className="ngcp-print-poster-doc-empty-title">NGCP document not attached</p>
                <p className="ngcp-print-poster-doc-empty-sub">
                  Upload the NGCP notice image in the advisory to render it in this poster.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="ngcp-print-poster-disclaimer">
          <p>{footer.disclaimer}</p>
          {footer.disclaimerBold ? <p className="ngcp-print-poster-disclaimer-strong">{footer.disclaimerBold}</p> : null}
          {footer.logoUrl ? <img className="ngcp-print-poster-logo" src={footer.logoUrl} alt="ALECO" /> : null}
        </div>

        <footer className="ngcp-print-poster-footer">
          <span>{footer.facebook}</span>
          <span>{footer.email}</span>
          <span>{footer.smart}</span>
          <span>{footer.globe}</span>
        </footer>
      </div>
    </div>
  );
}
