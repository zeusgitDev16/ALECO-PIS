import React from 'react';
import {
  getStatusDisplayLabel,
  getCauseCategoryLabel,
  TYPE_FORM_OPTIONS,
} from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isPublicVisibilityPending } from '../../utils/dateUtils';
import AdvisoryLog from './AdvisoryLog';

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
 */
export default function InterruptionAdvisoryViewOnly({ detail, loading = false, onClose }) {
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
            {d.imageUrl && (
              <div className="interruptions-admin-view-image">
                <img src={d.imageUrl} alt="Advisory" />
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
              <dt>Actual restoration</dt>
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
          {d.type === 'Unscheduled' ? (
            <p className="interruptions-admin-view-text">Shown immediately. Unscheduled outages are always published right away.</p>
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
