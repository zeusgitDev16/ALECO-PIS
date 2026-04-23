import React from 'react';
import {
  getStatusDisplayLabel,
  getCauseCategoryLabel,
  TYPE_FORM_OPTIONS,
  isEmergencyOutageType,
} from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isPublicVisibilityPending } from '../../utils/dateUtils';
import AdvisoryLog from './AdvisoryLog';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import { apiUrl } from '../../utils/api';
import InterruptionPosterAlignmentPreview from './InterruptionPosterAlignmentPreview';

function getTypeLabel(type) {
  const opt = TYPE_FORM_OPTIONS.find((o) => o.value === type);
  return opt ? opt.label : type || '—';
}

/**
 * Read-only view of an archived advisory. All fields rendered as plain text.
 * @param {object} props
 * @param {object} [props.detail] - Advisory DTO from API (editDetail)
 * @param {boolean} [props.loading]
 * @param {() => void} props.onClose
 * @param {() => void} [props.onGeneratePosterStub]
 * @param {() => void} [props.onCapturePoster]
 * @param {boolean} [props.posterAssetBusy]
 */
export default function InterruptionAdvisoryViewOnly({
  detail,
  loading = false,
  onClose,
  onGeneratePosterStub,
  onCapturePoster,
  posterAssetBusy = false,
}) {
  if (loading) {
    return (
      <div className="interruptions-admin-view-only interruptions-admin-modal-form">
        <div className="interruptions-admin-modal-scroll-outer">
          <div className="interruptions-admin-modal-body-scroll">
            <p className="interruptions-admin-memo-loading" aria-live="polite">
              Loading advisory…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="interruptions-admin-view-only interruptions-admin-modal-form">
        <div className="interruptions-admin-modal-scroll-outer">
          <div className="interruptions-admin-modal-body-scroll">
            <p className="interruptions-admin-view-empty">No advisory data.</p>
          </div>
        </div>
      </div>
    );
  }

  const d = detail;
  const feederDisplay = (d.feeder && String(d.feeder).trim()) || '—';
  const bodyText = (d.body && String(d.body).trim()) || '';
  const areasText = (d.affectedAreas || []).join(', ') || '—';
  const causeText = (d.cause && String(d.cause).trim()) || '—';
  const causeCatLabel = getCauseCategoryLabel(d.causeCategory);
  const hasScheduledPublic = Boolean(d.publicVisibleAt && String(d.publicVisibleAt).trim());
  const safeAdvisoryImageUrl = d.imageUrl ? getSafeResourceUrl(d.imageUrl) : null;
  const safePosterImageUrl =
    d.posterImageUrl && !String(d.posterImageUrl).startsWith('stub://')
      ? getSafeResourceUrl(d.posterImageUrl)
      : null;
  const grouped = Array.isArray(d.affectedAreasGrouped) ? d.affectedAreasGrouped : [];

  return (
    <div className="interruptions-admin-view-only interruptions-admin-modal-form">
      <div className="interruptions-admin-modal-scroll-outer">
        <div className="interruptions-admin-modal-body-scroll interruptions-admin-view-body">
        <section className="interruptions-admin-view-section">
          <h4 className="interruptions-admin-view-section-title">Classifications</h4>
          <dl className="interruptions-admin-view-dl">
            <div>
              <dt>Type</dt>
              <dd>{getTypeLabel(d.type)}</dd>
            </div>
            <div>
              <dt>Feeder</dt>
              <dd>{feederDisplay}</dd>
            </div>
            <div>
              <dt>Control #</dt>
              <dd>{d.controlNo ? String(d.controlNo).trim() : '—'}</dd>
            </div>
            {causeCatLabel && (
              <div>
                <dt>Cause category</dt>
                <dd>{causeCatLabel}</dd>
              </div>
            )}
          </dl>
        </section>

        {bodyText && (
          <section className="interruptions-admin-view-section">
            <h4 className="interruptions-admin-view-section-title">Advisory content</h4>
            <div className="interruptions-admin-view-body-text">
              {bodyText.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>
            {safeAdvisoryImageUrl && (
              <div className="interruptions-admin-view-image">
                <img src={safeAdvisoryImageUrl} alt="Advisory" />
              </div>
            )}
          </section>
        )}

        {(!bodyText || causeText !== '—') && (
          <section className="interruptions-admin-view-section">
            <h4 className="interruptions-admin-view-section-title">Where &amp; Why</h4>
            <dl className="interruptions-admin-view-dl">
              <div>
                <dt>Affected areas</dt>
                <dd>{areasText}</dd>
              </div>
              {grouped.length > 0 && (
                <div>
                  <dt>Poster sections (grouped)</dt>
                  <dd>
                    <ul className="interruptions-admin-view-grouped-list">
                      {grouped.map((block, bi) => (
                        <li key={bi}>
                          <strong>{block.heading || '(heading)'}</strong>
                          {Array.isArray(block.items) && block.items.length > 0 ? (
                            <ul>
                              {block.items.map((line, li) => (
                                <li key={li}>{line}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              <div>
                <dt>Cause / reason</dt>
                <dd>{causeText}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="interruptions-admin-view-section">
          <h4 className="interruptions-admin-view-section-title">Schedule</h4>
          <dl className="interruptions-admin-view-dl">
            <div>
              <dt>Start</dt>
              <dd>{d.dateTimeStart ? formatToPhilippineTime(d.dateTimeStart) : '—'}</dd>
            </div>
            <div>
              <dt>ERT (forecast)</dt>
              <dd>{d.dateTimeEndEstimated ? formatToPhilippineTime(d.dateTimeEndEstimated) : '—'}</dd>
            </div>
            <div>
              <dt>Energized at</dt>
              <dd>{d.dateTimeRestored ? formatToPhilippineTime(d.dateTimeRestored) : '—'}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{getStatusDisplayLabel(d.status)}</dd>
            </div>
          </dl>
        </section>

        <section className="interruptions-admin-view-section">
          <h4 className="interruptions-admin-view-section-title">Public bulletin</h4>
          {isEmergencyOutageType(d.type) ? (
            <p className="interruptions-admin-view-text">Shown immediately. Emergency outages are always published right away.</p>
          ) : hasScheduledPublic ? (
            <p className="interruptions-admin-view-text">
              {isPublicVisibilityPending(d.publicVisibleAt) ? (
                <>Goes live at {formatToPhilippineTime(d.publicVisibleAt)}</>
              ) : (
                <>Visible since {formatToPhilippineTime(d.publicVisibleAt)}</>
              )}
            </p>
          ) : (
            <p className="interruptions-admin-view-text">Show immediately</p>
          )}
        </section>

        <details className="interruptions-admin-view-section interruptions-admin-poster-preview-details">
          <summary className="interruptions-admin-poster-preview-summary">Poster fields preview</summary>
          <InterruptionPosterAlignmentPreview dto={d} />
        </details>

        <section className="interruptions-admin-view-section">
          <h4 className="interruptions-admin-view-section-title">Poster image (read-only)</h4>
          <p className="interruptions-admin-field-hint">
            Stored URL for rendered poster capture (e.g. Cloudinary). Stub values are placeholders until Puppeteer runs on
            the API host.
          </p>
          <dl className="interruptions-admin-view-dl">
            <div>
              <dt>poster_image_url</dt>
              <dd>
                {d.posterImageUrl ? String(d.posterImageUrl) : '—'}
                {safePosterImageUrl && (
                  <div className="interruptions-admin-view-image interruptions-admin-view-image--poster">
                    <img src={safePosterImageUrl} alt="Poster preview" />
                  </div>
                )}
              </dd>
            </div>
          </dl>
          {(typeof onCapturePoster === 'function' || typeof onGeneratePosterStub === 'function') && (
            <div className="interruptions-admin-poster-stub-actions">
              {typeof onCapturePoster === 'function' && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--submit"
                  onClick={() => onCapturePoster()}
                  disabled={posterAssetBusy}
                >
                  {posterAssetBusy ? 'Working…' : 'Capture poster (screenshot)'}
                </button>
              )}
              {typeof onGeneratePosterStub === 'function' && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--secondary"
                  onClick={() => onGeneratePosterStub()}
                  disabled={posterAssetBusy}
                >
                  {posterAssetBusy ? 'Working…' : 'Generate poster stub'}
                </button>
              )}
            </div>
          )}
        </section>

        {d.id != null && Number.isFinite(Number(d.id)) && (
          <section className="interruptions-admin-view-section interruptions-admin-poster-share-panel">
            <h4 className="interruptions-admin-view-section-title">Share links</h4>
            <p className="interruptions-admin-field-hint">
              For Facebook, share the <strong>HTML share page</strong> so crawlers read <code>og:image</code>. Use the
              direct image URL when you only need the raster.
            </p>
            <p className="interruptions-admin-share-line">
              <span className="interruptions-admin-share-label">Share (HTML / OG)</span>
              <code className="interruptions-admin-share-url">{apiUrl(`/api/share/interruption/${d.id}`)}</code>
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--secondary"
                onClick={() => {
                  const u = apiUrl(`/api/share/interruption/${d.id}`);
                  navigator.clipboard?.writeText(u).catch(() => {});
                }}
              >
                Copy
              </button>
            </p>
            {d.posterImageUrl && String(d.posterImageUrl).trim().startsWith('http') ? (
              <p className="interruptions-admin-share-line">
                <span className="interruptions-admin-share-label">Direct image</span>
                <code className="interruptions-admin-share-url">{String(d.posterImageUrl).trim()}</code>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--secondary"
                  onClick={() => {
                    const u = String(d.posterImageUrl).trim();
                    navigator.clipboard?.writeText(u).catch(() => {});
                  }}
                >
                  Copy
                </button>
              </p>
            ) : null}
          </section>
        )}

        <AdvisoryLog
          updates={d.updates || []}
          createdAt={d.createdAt}
          deletedAt={d.deletedAt}
        />
        </div>
      </div>

      <div className="interruptions-admin-modal-footer">
        <button type="button" className="interruptions-admin-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
