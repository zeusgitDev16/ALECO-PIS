import React, { useMemo, useState, useRef } from 'react';
import {
  STATUS_FORM_OPTIONS,
  TYPE_FORM_OPTIONS,
  CAUSE_CATEGORY_FORM_OPTIONS,
  getStatusDisplayLabel,
} from '../../utils/interruptionLabels';
import {
  datetimeLocalToApi,
  computeInitialStatusPreview,
  datetimeLocalStringToDate,
} from '../../utils/interruptionFormUtils';
import { formatAdvisoryDateTime } from '../../utils/interruptionDateFormat';
import BulletinDatetimePicker from './BulletinDatetimePicker';
import { uploadInterruptionImage } from '../../api/interruptionsApi';

const BODY_PLACEHOLDER =
  'Type your advisory like a Facebook post. Include date, time, affected areas, and reason. You can use line breaks and structure.';

const BODY_TEMPLATE = `Date: [Date]
Time: [Time]
Affected Areas: [Areas]
Reason: [Reason]

ADDITIONAL DETAILS:
[Additional details]`;

function toDatetimeLocalFromDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function addMs(ms) {
  return toDatetimeLocalFromDate(new Date(Date.now() + ms));
}

const PRESETS = [
  { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { key: '12h', label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { key: '1d', label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { key: '2d', label: '2 days', ms: 2 * 24 * 60 * 60 * 1000 },
];

function DatetimePreview({ value }) {
  const api = datetimeLocalToApi(value);
  if (!api) return null;
  return (
    <p className="interruptions-admin-datetime-preview">
      <span className="interruptions-admin-datetime-preview-label">Shows as:</span>{' '}
      {formatAdvisoryDateTime(api)}
    </p>
  );
}

export default function InterruptionAdvisoryForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  editingId,
  detailLoading = false,
  saving,
  memoSlot = null,
  saveConflict = false,
  onReloadAdvisory,
  advisoryArchived = false,
  validationErrors = [],
}) {
  const initialLifecyclePreview = useMemo(
    () => computeInitialStatusPreview(form.type, form.dateTimeStart),
    [form.type, form.dateTimeStart]
  );

  const unscheduledFutureStart = useMemo(() => {
    if (form.type !== 'Unscheduled') return false;
    const d = datetimeLocalStringToDate(form.dateTimeStart);
    return Boolean(d && d.getTime() > Date.now());
  }, [form.type, form.dateTimeStart]);

  const lifecycleSteps = useMemo(() => {
    if (form.type === 'Unscheduled') return ['Ongoing', 'Restored'];
    return ['Pending', 'Ongoing', 'Restored'];
  }, [form.type]);

  const currentLifecycleStep = editingId ? form.status : initialLifecyclePreview.apiStatus;

  const [quickFieldsOpen, setQuickFieldsOpen] = useState(true);
  const [legacyFieldsOpen, setLegacyFieldsOpen] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);
  const hasBody = form.body && String(form.body).trim();
  const showLegacyFields = !hasBody;

  const insertTemplate = () => {
    const apiStart = form.dateTimeStart ? datetimeLocalToApi(form.dateTimeStart) : null;
    const [datePart = '[Date]', timePart = '[Time]'] = apiStart ? apiStart.split(' ') : [];
    const template = BODY_TEMPLATE.replace('[Date]', datePart)
      .replace('[Time]', timePart)
      .replace('[Areas]', form.affectedAreasText || '[Areas]')
      .replace('[Reason]', form.cause || '[Reason]');
    setForm((f) => ({ ...f, body: template }));
  };

  const handleImageSelect = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const result = await uploadInterruptionImage(file);
    setImageUploading(false);
    if (result.ok && result.imageUrl) {
      setForm((f) => ({ ...f, imageUrl: result.imageUrl }));
    }
    ev.target.value = '';
  };

  const handleTypeChange = (v) => {
    setForm((f) => ({
      ...f,
      type: v,
      ...(v === 'Unscheduled' ? { schedulePublicLater: false, publicVisibleAt: '' } : {}),
    }));
  };

  const setPreset = (ms) => {
    setForm((f) => ({
      ...f,
      schedulePublicLater: true,
      publicVisibleAt: addMs(ms),
    }));
  };

  return (
    <form className="interruptions-admin-modal-form" onSubmit={onSubmit}>
      {validationErrors.length > 0 && (
        <div
          className="interruptions-admin-callout interruptions-admin-callout--warn"
          role="alert"
        >
          <ul className="interruptions-admin-validation-list">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {saveConflict && (
        <div
          className="interruptions-admin-callout interruptions-admin-callout--warn interruptions-admin-conflict-banner"
          role="alert"
        >
          <p className="interruptions-admin-conflict-banner-text">
            Another session may have saved changes. Reload this advisory to continue editing safely.
          </p>
          {typeof onReloadAdvisory === 'function' && (
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--submit"
              onClick={onReloadAdvisory}
              disabled={saving}
            >
              Reload advisory
            </button>
          )}
        </div>
      )}
      <div
        className={`interruptions-admin-modal-scroll-outer${advisoryArchived ? ' interruptions-admin-archived-form-wrap' : ''}`}
      >
        <div className="interruptions-admin-modal-body-scroll">
        {editingId && detailLoading ? (
          <p className="interruptions-admin-memo-loading" aria-live="polite">
            Loading advisory…
          </p>
        ) : (
        <>
        <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--body">
          <legend>What you want to say</legend>
          <div className="interruptions-admin-body-wrap">
            <textarea
              className="interruptions-admin-body-textarea"
              rows={8}
              value={form.body}
              onChange={(ev) => setForm((f) => ({ ...f, body: ev.target.value }))}
              placeholder={BODY_PLACEHOLDER}
              aria-label="Advisory content"
            />
            <div className="interruptions-admin-body-actions">
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--secondary"
                onClick={insertTemplate}
              >
                Insert template
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--quick">
          <legend>
            <button
              type="button"
              className="interruptions-admin-collapse-trigger"
              onClick={() => setQuickFieldsOpen((o) => !o)}
              aria-expanded={quickFieldsOpen}
            >
              {quickFieldsOpen ? '▼' : '▶'} Quick fields
            </button>
          </legend>
          {quickFieldsOpen && (
          <>
          <div className="interruptions-admin-form-grid interruptions-admin-form-grid--modal">
            <label className="interruptions-admin-span2">
              Outage type
              <select
                value={form.type}
                onChange={(ev) => handleTypeChange(ev.target.value)}
              >
                {TYPE_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Feeder
              <input
                type="text"
                value={form.feeder}
                onChange={(ev) => setForm((f) => ({ ...f, feeder: ev.target.value }))}
                placeholder="Feeder name or ID"
              />
            </label>
            <label>
              Control #
              <input
                type="text"
                value={form.controlNo}
                onChange={(ev) => setForm((f) => ({ ...f, controlNo: ev.target.value }))}
                placeholder="e.g. SIMAR2026-037"
              />
            </label>
            <label>
              Start
              <div className="interruptions-admin-datetime-wrap">
                <input
                  className="interruptions-admin-datetime-input"
                  type="datetime-local"
                  value={form.dateTimeStart}
                  onChange={(ev) => setForm((f) => ({ ...f, dateTimeStart: ev.target.value }))}
                />
              </div>
              <DatetimePreview value={form.dateTimeStart} />
            </label>
            <label>
              Estimated restoration (ERT)
              <div className="interruptions-admin-datetime-wrap">
                <input
                  className="interruptions-admin-datetime-input"
                  type="datetime-local"
                  value={form.dateTimeEndEstimated}
                  onChange={(ev) => setForm((f) => ({ ...f, dateTimeEndEstimated: ev.target.value }))}
                />
              </div>
              <DatetimePreview value={form.dateTimeEndEstimated} />
            </label>
            <label className="interruptions-admin-span2">
              Cause category (optional)
              <select
                value={form.causeCategory || ''}
                onChange={(ev) => setForm((f) => ({ ...f, causeCategory: ev.target.value }))}
              >
                {CAUSE_CATEGORY_FORM_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="interruptions-admin-span2 interruptions-admin-image-upload">
              <label>Advisory image (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={imageUploading}
                style={{ display: 'none' }}
              />
              <div className="interruptions-admin-image-row">
                {form.imageUrl && (
                  <div className="interruptions-admin-image-preview">
                    <img src={form.imageUrl} alt="Advisory" />
                    <button
                      type="button"
                      className="interruptions-admin-btn interruptions-admin-btn--small"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  {imageUploading ? 'Uploading…' : form.imageUrl ? 'Change image' : 'Add image'}
                </button>
              </div>
            </div>
            {editingId ? (
              <div className="interruptions-admin-span2">
                <div className="interruptions-admin-lifecycle-preview-title">Lifecycle</div>
                <div className="interruptions-admin-lifecycle-stepper" role="status">
                  {lifecycleSteps.map((step, i) => (
                    <React.Fragment key={step}>
                      <div
                        className={`interruptions-admin-stepper-step${form.status === step ? ' interruptions-admin-stepper-step--active' : ''}`}
                      >
                        <span className="interruptions-admin-stepper-dot" aria-hidden="true" />
                        <span className="interruptions-admin-stepper-label">{getStatusDisplayLabel(step)}</span>
                      </div>
                      {i < lifecycleSteps.length - 1 && (
                        <span className="interruptions-admin-stepper-connector" aria-hidden="true" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <label className="interruptions-admin-stepper-select-wrap">
                  Lifecycle
                <select
                  value={form.status}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setForm((f) => {
                      const next = { ...f, status: v };
                      if (v === 'Restored') {
                        next.dateTimeRestored = f.dateTimeRestored && String(f.dateTimeRestored).trim()
                          ? f.dateTimeRestored
                          : toDatetimeLocalFromDate(new Date());
                      } else {
                        next.dateTimeRestored = '';
                      }
                      return next;
                    });
                  }}
                >
                  {STATUS_FORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                </label>
              </div>
            ) : (
              <div className="interruptions-admin-span2">
                <div className="interruptions-admin-lifecycle-preview-title">Lifecycle</div>
                <div className="interruptions-admin-lifecycle-stepper" role="status" aria-live="polite">
                  {lifecycleSteps.map((step, i) => (
                    <React.Fragment key={step}>
                      <div
                        className={`interruptions-admin-stepper-step${currentLifecycleStep === step ? ' interruptions-admin-stepper-step--active' : ''}`}
                      >
                        <span className="interruptions-admin-stepper-dot" aria-hidden="true" />
                        <span className="interruptions-admin-stepper-label">{getStatusDisplayLabel(step)}</span>
                      </div>
                      {i < lifecycleSteps.length - 1 && (
                        <span className="interruptions-admin-stepper-connector" aria-hidden="true" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
            {unscheduledFutureStart && (
              <div
                className="interruptions-admin-callout interruptions-admin-callout--warn"
                role="note"
              >
                Unscheduled with a future start is unusual—confirm type or start time.
              </div>
            )}
          </>
          )}
        </fieldset>

        {(showLegacyFields || hasBody) && (
        <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--legacy">
          <legend>
            {hasBody ? (
              <button
                type="button"
                className="interruptions-admin-collapse-trigger"
                onClick={() => setLegacyFieldsOpen((o) => !o)}
                aria-expanded={legacyFieldsOpen}
              >
                {legacyFieldsOpen ? '▼' : '▶'} Legacy metadata (optional)
              </button>
            ) : (
              'Where & Why'
            )}
          </legend>
          {(showLegacyFields || legacyFieldsOpen) && (
          <div className="interruptions-admin-form-grid interruptions-admin-form-grid--modal">
            <label className="interruptions-admin-span2">
              Affected areas (comma-separated)
              <input
                type="text"
                value={form.affectedAreasText}
                onChange={(ev) => setForm((f) => ({ ...f, affectedAreasText: ev.target.value }))}
                placeholder="Legazpi City, Daraga"
              />
            </label>
            <label className="interruptions-admin-span2">
              Cause / reason
              <input
                type="text"
                value={form.cause}
                onChange={(ev) => setForm((f) => ({ ...f, cause: ev.target.value }))}
                placeholder="Maintenance, fault, weather…"
              />
            </label>
          </div>
          )}
        </fieldset>
        )}

        <fieldset
          className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--bull"
        >
          <legend>Public bulletin</legend>
          {form.type === 'Unscheduled' ? (
            <p className="interruptions-admin-bull-unscheduled-note">
              Shown immediately. Unscheduled outages are always published right away.
            </p>
          ) : (
            <>
              <div className="interruptions-admin-visibility-toggle" role="radiogroup" aria-label="Public visibility">
                <label className="interruptions-admin-radio-line">
                  <input
                    type="radio"
                    name="pubvis"
                    checked={!form.schedulePublicLater}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        schedulePublicLater: false,
                        publicVisibleAt: '',
                      }))
                    }
                  />
                  <span>Show immediately</span>
                </label>
                <label className="interruptions-admin-radio-line">
                  <input
                    type="radio"
                    name="pubvis"
                    checked={form.schedulePublicLater}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        schedulePublicLater: true,
                        publicVisibleAt: f.publicVisibleAt || addMs(60 * 60 * 1000),
                      }))
                    }
                  />
                  <span>Schedule first public appearance</span>
                </label>
              </div>

              {form.schedulePublicLater && (
            <div className="interruptions-admin-bull-schedule">
              <label className="interruptions-admin-span2 interruptions-admin-label-tight">
                Goes live at
                <div className="interruptions-admin-datetime-wrap interruptions-admin-datetime-wrap--bull">
                  <BulletinDatetimePicker
                    value={form.publicVisibleAt}
                    onChange={(v) => setForm((f) => ({ ...f, publicVisibleAt: v }))}
                    required={form.schedulePublicLater}
                  />
                </div>
                <DatetimePreview value={form.publicVisibleAt} />
              </label>
              <div className="interruptions-admin-preset-row" role="group" aria-label="Quick schedule presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="interruptions-admin-preset-chip"
                    onClick={() => setPreset(p.ms)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
              )}
            </>
          )}
        </fieldset>

        {memoSlot}

        {advisoryArchived && (
          <div className="interruptions-admin-callout interruptions-admin-callout--warn" role="status">
            <strong>Archived</strong> — restore from the list to edit or publish again.
          </div>
        )}

        {editingId && (
          <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--resolve">
            <legend>Resolve</legend>
            {form.status === 'Restored' ? (
              <label className="interruptions-admin-span2">
                Actual restoration date and time
                <div className="interruptions-admin-datetime-wrap">
                  <input
                    className="interruptions-admin-datetime-input"
                    type="datetime-local"
                    value={form.dateTimeRestored}
                    onChange={(ev) => setForm((f) => ({ ...f, dateTimeRestored: ev.target.value }))}
                    required
                  />
                </div>
                <DatetimePreview value={form.dateTimeRestored} />
              </label>
            ) : (
              <p className="interruptions-admin-resolve-placeholder">Set lifecycle to Resolved to enter restoration time.</p>
            )}
          </fieldset>
        )}
        </>
        )}
        </div>
      </div>

      <div className="interruptions-admin-modal-footer">
        <button type="button" className="interruptions-admin-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="submit"
          className="interruptions-admin-btn interruptions-admin-btn--submit"
          disabled={saving || advisoryArchived}
        >
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish advisory'}
        </button>
      </div>
    </form>
  );
}
