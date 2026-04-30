import React, { useMemo, useState, useRef, useEffect } from 'react';
import InterruptionPosterAlignmentPreview from './InterruptionPosterAlignmentPreview';
import {
  TYPE_FORM_OPTIONS,
  CAUSE_CATEGORY_FORM_OPTIONS,
  isEmergencyOutageType,
  isCustomPosterType,
} from '../../utils/interruptionLabels';
import {
  datetimeLocalToApi,
  datetimeLocalStringToDate,
  formStateToPosterPreviewDto,
} from '../../utils/interruptionFormUtils';
import {
  formatPhilippineWallClock,
  formatPhilippineTemplateDateNow,
  formatPhilippineTemplateTimeNow,
} from '../../utils/dateUtils';
import FeederCascadeSelect from './FeederCascadeSelect';
import InModalDateTimePicker from './InModalDateTimePicker';
import { uploadInterruptionImage } from '../../api/interruptionsApi';
import { apiUrl } from '../../utils/api';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import { useNow } from '../../hooks/useNow';

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
      {formatPhilippineWallClock(api)}
    </p>
  );
}

function GoesLiveCountdown({ value }) {
  const [now, setNow] = useState(() => Date.now());
  const target = datetimeLocalStringToDate(value);
  useEffect(() => {
    if (!value || !target || target.getTime() <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [value]);
  if (!target || target.getTime() <= now) return null;
  const diff = target.getTime() - now;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return (
    <p className="interruptions-admin-countdown" role="status">
      <strong>Goes live in</strong> {parts.join(' ')}
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
  saveConflict = false,
  onReloadAdvisory,
  advisoryArchived = false,
  validationErrors = [],
  onUpdatePoster,
  posterUpdateRequired = false,
  posterAssetBusy = false,
}) {
  const now = useNow([]);
  const isNgcpScheduled = form.type === 'NgcScheduled';
  const isCustomPoster = isCustomPosterType(form.type);
  const lockTypeChange = Boolean(editingId && (isNgcpScheduled || isCustomPoster));
  const unscheduledFutureStart = useMemo(() => {
    if (!isEmergencyOutageType(form.type)) return false;
    const d = datetimeLocalStringToDate(form.dateTimeStart);
    return Boolean(d && d.getTime() > now);
  }, [form.type, form.dateTimeStart, now]);

  const [quickFieldsOpen, setQuickFieldsOpen] = useState(true);
  const [legacyFieldsOpen, setLegacyFieldsOpen] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadHint, setImageUploadHint] = useState('');

  useEffect(() => {
    if (validationErrors.some((e) => e.toLowerCase().includes('remark'))) {
      setQuickFieldsOpen(true);
    }
  }, [validationErrors]);
  const fileInputRef = useRef(null);
  const hasBody = form.body && String(form.body).trim();
  const showLegacyFields = !hasBody;

  const safeImagePreviewUrl = useMemo(
    () => (form.imageUrl ? getSafeResourceUrl(form.imageUrl) : null),
    [form.imageUrl]
  );

  const posterPreviewDto = useMemo(() => formStateToPosterPreviewDto(form), [form]);

  const insertTemplate = () => {
    const datePart = formatPhilippineTemplateDateNow();
    const timePart = formatPhilippineTemplateTimeNow();
    const template = BODY_TEMPLATE.replace('[Date]', datePart)
      .replace('[Time]', timePart)
      .replace('[Areas]', form.affectedAreasText || '[Areas]')
      .replace('[Reason]', form.cause || '[Reason]');
    setForm((f) => ({ ...f, body: template }));
  };

  const handleImageSelect = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImageUploadHint('');
    if (isNgcpScheduled) {
      try {
        const dim = await new Promise((resolve, reject) => {
          const blobUrl = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            const out = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
            URL.revokeObjectURL(blobUrl);
            resolve(out);
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Could not read image dimensions.'));
          };
          img.src = blobUrl;
        });
        const minW = 1200;
        const minH = 700;
        const recW = 1800;
        const recH = 1100;
        if (dim.width < minW || dim.height < minH) {
          setImageUploadHint(
            `Image is ${dim.width}x${dim.height}. Upload will continue, but poster text may look soft. Recommended minimum is ${minW}x${minH}.`
          );
        }
        if (dim.width < recW || dim.height < recH) {
          setImageUploadHint(
            `Image accepted (${dim.width}x${dim.height}), but ${recW}x${recH} or higher is recommended for sharper text.`
          );
        }
      } catch {
        setImageUploadHint('Could not inspect image quality. Upload will continue as-is.');
      }
    }
    setImageUploading(true);
    const result = await uploadInterruptionImage(file, { contextType: form.type });
    setImageUploading(false);
    if (result.ok && result.imageUrl) {
      setForm((f) => ({ ...f, imageUrl: result.imageUrl }));
    } else if (result.message) {
      setImageUploadHint(result.message);
    }
    ev.target.value = '';
  };

  const handleTypeChange = (v) => {
    setForm((f) => ({
      ...f,
      type: v,
      ...(isEmergencyOutageType(v) ? { schedulePublicLater: false, publicVisibleAt: '' } : {}),
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
                disabled={lockTypeChange}
              >
                {TYPE_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {lockTypeChange && (
                <span className="interruptions-admin-field-hint">
                  Outage type is locked after creation to keep UI and backend rules consistent.
                </span>
              )}
            </label>
            {!isNgcpScheduled && !isCustomPoster && (
              <label>
                Feeder
                <FeederCascadeSelect
                  value={form.feeder}
                  onChange={(v) => setForm((f) => ({ ...f, feeder: v }))}
                  onFeederIdChange={(fid) => setForm((f) => ({ ...f, feederId: fid }))}
                  disabled={advisoryArchived}
                />
              </label>
            )}
            {!isNgcpScheduled && !isCustomPoster && (
              <label>
                Control #
                <input
                  type="text"
                  value={form.controlNo}
                  onChange={(ev) => setForm((f) => ({ ...f, controlNo: ev.target.value }))}
                  placeholder="e.g. SIMAR2026-037"
                />
              </label>
            )}
            <label className="interruptions-admin-datetime-field">
              Start
              <div className="interruptions-admin-datetime-wrap">
                <InModalDateTimePicker
                  value={form.dateTimeStart}
                  onChange={(v) => setForm((f) => ({ ...f, dateTimeStart: v }))}
                  placeholder="Select start date and time"
                  futureOnly
                />
              </div>
              <DatetimePreview value={form.dateTimeStart} />
            </label>
            {!isNgcpScheduled && !isCustomPoster && (
              <label className="interruptions-admin-datetime-field">
                Estimated restoration (ERT)
                <div className="interruptions-admin-datetime-wrap">
                  <InModalDateTimePicker
                    value={form.dateTimeEndEstimated}
                    onChange={(v) => setForm((f) => ({ ...f, dateTimeEndEstimated: v }))}
                    placeholder="Select ERT date and time"
                    futureOnly
                  />
                </div>
                <DatetimePreview value={form.dateTimeEndEstimated} />
              </label>
            )}
            {!isNgcpScheduled && !isCustomPoster && (
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
            )}
            <div
              className={`interruptions-admin-span2 interruptions-admin-image-upload${isNgcpScheduled ? ' interruptions-admin-image-upload--ngcp' : isCustomPoster ? ' interruptions-admin-image-upload--custom' : ''}`}
            >
              <label>
                {isNgcpScheduled
                  ? 'Official NGCP notice image (required)'
                  : isCustomPoster
                  ? 'Custom poster image (required)'
                  : 'Advisory image (optional)'}
              </label>
              {isNgcpScheduled && (
                <p className="interruptions-admin-field-hint interruptions-admin-image-upload-note--ngcp">
                  Attach the official NGCP poster/notice image. This is required and will be embedded at the center
                  of the ALECO NGCP poster template. Use high-resolution source files (recommended 1800x1100+).
                </p>
              )}
              {isCustomPoster && (
                <p className="interruptions-admin-field-hint interruptions-admin-image-upload-note--custom">
                  Upload your custom poster (e.g. from Canva). This image is shown directly in the public feed as
                  the poster — no template is generated. All other fields below are optional.
                </p>
              )}
              {imageUploadHint && (
                <p className="interruptions-admin-field-hint interruptions-admin-image-upload-note--quality">
                  {imageUploadHint}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={imageUploading}
                style={{ display: 'none' }}
              />
              <div className="interruptions-admin-image-row">
                {form.imageUrl && safeImagePreviewUrl && (
                  <div className="interruptions-admin-image-preview">
                    <img src={safeImagePreviewUrl} alt="Advisory" />
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
                  className={`interruptions-admin-btn interruptions-admin-btn--secondary${isNgcpScheduled ? ' interruptions-admin-btn--ngcp-image' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  {imageUploading ? 'Uploading…' : form.imageUrl ? 'Change image' : 'Add image'}
                </button>
              </div>
            </div>
          </div>
            {unscheduledFutureStart && (
              <div
                className="interruptions-admin-callout interruptions-admin-callout--warn"
                role="note"
              >
                Emergency outages with a future start are unusual—confirm type or start time.
              </div>
            )}
          </>
          )}
        </fieldset>

        {!isNgcpScheduled && (showLegacyFields || hasBody) && (
        <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--legacy">
          <legend>
            {hasBody ? (
              <button
                type="button"
                className="interruptions-admin-collapse-trigger"
                onClick={() => setLegacyFieldsOpen((o) => !o)}
                aria-expanded={legacyFieldsOpen}
              >
                {legacyFieldsOpen ? '▼' : '▶'} {isCustomPoster ? 'Where & Why (optional)' : 'Legacy metadata (optional)'}
              </button>
            ) : (
              isCustomPoster ? 'Where & Why (optional)' : 'Where & Why'
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
            <div className="interruptions-admin-span2 interruptions-admin-grouped-areas">
              <span className="interruptions-admin-grouped-areas-label">Poster sections (optional)</span>
              <p className="interruptions-admin-field-hint">
                Section heading plus one bullet per line. If empty, the comma-separated list above is used on the poster.
              </p>
              {(form.affectedAreasGrouped || []).map((block, bi) => (
                <div key={bi} className="interruptions-admin-grouped-block">
                  <label>
                    Section heading
                    <input
                      type="text"
                      value={block.heading || ''}
                      onChange={(ev) =>
                        setForm((f) => {
                          const g = [...(f.affectedAreasGrouped || [])];
                          g[bi] = { ...g[bi], heading: ev.target.value };
                          return { ...f, affectedAreasGrouped: g };
                        })
                      }
                      placeholder="e.g. PORTION OF LEGAZPI CITY"
                    />
                  </label>
                  <label>
                    Bullets (one per line)
                    <textarea
                      className="interruptions-admin-grouped-bullets-textarea"
                      rows={4}
                      value={(block.items || []).join('\n')}
                      onChange={(ev) => {
                        const lines = ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean);
                        setForm((f) => {
                          const g = [...(f.affectedAreasGrouped || [])];
                          g[bi] = { ...g[bi], items: lines.length ? lines : [] };
                          return { ...f, affectedAreasGrouped: g };
                        });
                      }}
                      placeholder={'Barangay A\nBarangay B'}
                    />
                  </label>
                  <button
                    type="button"
                    className="interruptions-admin-btn interruptions-admin-btn--small interruptions-admin-btn--secondary"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        affectedAreasGrouped: (f.affectedAreasGrouped || []).filter((_, i) => i !== bi),
                      }))
                    }
                  >
                    Remove section
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--secondary"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    affectedAreasGrouped: [...(f.affectedAreasGrouped || []), { heading: '', items: [] }],
                  }))
                }
              >
                Add section
              </button>
            </div>
            <label className="interruptions-admin-span2">
              Cause / reason
              <input
                type="text"
                value={form.cause}
                onChange={(ev) => setForm((f) => ({ ...f, cause: ev.target.value }))}
                placeholder="Maintenance, fault, weather…"
              />
              <span className="interruptions-admin-field-hint">
                Shown on the poster as REASON when filled; otherwise the advisory body is used.
              </span>
            </label>
            <label>
              Substation / recloser (optional)
              <input
                type="text"
                value={form.substationRecloser}
                onChange={(ev) => setForm((f) => ({ ...f, substationRecloser: ev.target.value }))}
                placeholder="e.g. Daraga Substation"
              />
            </label>
            <label>
              Indication & magnitude (optional)
              <input
                type="text"
                value={form.indicationMagnitude}
                onChange={(ev) => setForm((f) => ({ ...f, indicationMagnitude: ev.target.value }))}
                placeholder="e.g. Fault current / feeder trip"
              />
            </label>
            <label>
              Possible fault location (optional)
              <input
                type="text"
                value={form.possibleFaultLocation}
                onChange={(ev) => setForm((f) => ({ ...f, possibleFaultLocation: ev.target.value }))}
                placeholder="e.g. Brgy. Sample, pole 23"
              />
            </label>
            <label>
              Linemen on duty (optional)
              <input
                type="text"
                value={form.linemenOnDuty}
                onChange={(ev) => setForm((f) => ({ ...f, linemenOnDuty: ev.target.value }))}
                placeholder="Crew names / team code"
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
          {!editingId ? (
            <>
              <p className="interruptions-admin-field-hint">
                <strong>Finalize this now:</strong> once published, public bulletin timing cannot be edited.
                Double-check this setting, especially for scheduled advisories.
              </p>
              {isEmergencyOutageType(form.type) ? (
                <p className="interruptions-admin-bull-unscheduled-note">
                  Shown immediately. Emergency outages are always published right away.
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
                  <label className="interruptions-admin-span2 interruptions-admin-label-tight interruptions-admin-datetime-field">
                    Goes live at
                    <div className="interruptions-admin-datetime-wrap interruptions-admin-datetime-wrap--bull">
                      <InModalDateTimePicker
                        value={form.publicVisibleAt}
                        onChange={(v) => setForm((f) => ({ ...f, publicVisibleAt: v }))}
                        required={form.schedulePublicLater}
                        placeholder="Select goes live date and time"
                        futureOnly
                      />
                    </div>
                    <DatetimePreview value={form.publicVisibleAt} />
                    <GoesLiveCountdown value={form.publicVisibleAt} />
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
            </>
          ) : (
            <p className="interruptions-admin-field-hint">
              Public bulletin timing is locked after publish and cannot be edited here.
            </p>
          )}
        </fieldset>

        <fieldset className="interruptions-admin-fieldset interruptions-admin-fieldset--compact interruptions-admin-fieldset--auto-restore">
          <legend>Scheduled auto-restoration</legend>
          <div className="interruptions-admin-visibility-toggle" role="radiogroup" aria-label="Auto-restoration schedule">
            <label className="interruptions-admin-radio-line">
              <input
                type="radio"
                name="autoRestore"
                checked={!form.scheduleAutoRestore}
                onChange={() =>
                  setForm((f) => ({
                    ...f,
                    scheduleAutoRestore: false,
                    scheduledRestoreAt: '',
                    scheduledRestoreRemark: '',
                  }))
                }
              />
              <span>Manual restoration only</span>
            </label>
            <label className="interruptions-admin-radio-line">
              <input
                type="radio"
                name="autoRestore"
                checked={form.scheduleAutoRestore}
                onChange={() =>
                  setForm((f) => ({
                    ...f,
                    scheduleAutoRestore: true,
                    scheduledRestoreAt: f.scheduledRestoreAt || '',
                    scheduledRestoreRemark: f.scheduledRestoreRemark || '',
                  }))
                }
              />
              <span>Schedule automatic restoration</span>
            </label>
          </div>

          {form.scheduleAutoRestore && (
            <div className="interruptions-admin-bull-schedule">
              <label className="interruptions-admin-span2 interruptions-admin-label-tight interruptions-admin-datetime-field">
                Auto-restore at
                <div className="interruptions-admin-datetime-wrap interruptions-admin-datetime-wrap--bull">
                  <InModalDateTimePicker
                    value={form.scheduledRestoreAt}
                    onChange={(v) => setForm((f) => ({ ...f, scheduledRestoreAt: v }))}
                    required={!isNgcpScheduled}
                    placeholder="Select auto-restoration date and time"
                    futureOnly
                    strictlyAfter={datetimeLocalStringToDate(
                      (isNgcpScheduled || isCustomPoster) ? form.dateTimeStart : form.dateTimeEndEstimated
                    )}
                  />
                </div>
                <DatetimePreview value={form.scheduledRestoreAt} />
                {(isNgcpScheduled || isCustomPoster) ? (
                  <p className="interruptions-admin-field-hint">
                    Optional: leave this blank to keep the advisory in pending/manual restoration mode.
                    Set a date later when ready to arm auto-restoration.
                  </p>
                ) : form.dateTimeEndEstimated && String(form.dateTimeEndEstimated).trim() && (
                  <p className="interruptions-admin-field-hint">
                    Auto-restore must be <strong>after</strong> ERT (
                    {formatPhilippineWallClock(datetimeLocalToApi(form.dateTimeEndEstimated))}
                    ). Same-day example: if ERT is 5:00 PM, use 5:01 PM or later.
                  </p>
                )}
              </label>
              <label className="interruptions-admin-span2 interruptions-admin-label-tight">
                <span>
                  Remark for auto-restoration <strong className="interruptions-admin-status-remark-required">(required)</strong>
                </span>
                <textarea
                  className="interruptions-admin-memo-textarea"
                  value={form.scheduledRestoreRemark}
                  onChange={(ev) => setForm((f) => ({ ...f, scheduledRestoreRemark: ev.target.value }))}
                  rows={2}
                  placeholder="e.g. Maintenance window complete, power restored per schedule"
                />
              </label>
              <p className="interruptions-admin-field-hint">
                When the scheduled time arrives, the system will automatically mark this advisory as <strong>Energized</strong> and log the remark above.
              </p>
            </div>
          )}
        </fieldset>

        {!isCustomPoster && (
        <details className="interruptions-admin-fieldset interruptions-admin-poster-preview-details">
          <summary className="interruptions-admin-poster-preview-summary">Poster fields preview</summary>
          <InterruptionPosterAlignmentPreview dto={posterPreviewDto} />
        </details>
        )}

        {!isCustomPoster && editingId && typeof onUpdatePoster === 'function' && (
          <div className="interruptions-admin-poster-stub-panel">
            <p className="interruptions-admin-field-hint">
              Keep the public poster synchronized with advisory edits.
            </p>
            {posterUpdateRequired && (
              <p className="interruptions-admin-callout interruptions-admin-callout--warn" role="status">
                Update poster is required before closing this advisory.
              </p>
            )}
            <div className="interruptions-admin-poster-stub-actions">
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--submit"
                onClick={() => onUpdatePoster()}
                disabled={posterAssetBusy || saving || detailLoading}
              >
                {posterAssetBusy ? 'Working…' : 'Update poster'}
              </button>
            </div>
          </div>
        )}
        {isCustomPoster && editingId && (
          <div className="interruptions-admin-poster-stub-panel">
            <p className="interruptions-admin-field-hint">
              This advisory uses your uploaded custom image as the poster — no template generation is needed.
              To update the poster, upload a new image above.
            </p>
          </div>
        )}

        {editingId && (
          <div className="interruptions-admin-poster-stub-panel interruptions-admin-poster-share-panel">
            <p className="interruptions-admin-field-hint">
              <strong>Share for Facebook:</strong> use the <strong>share page</strong> URL so the crawler reads{' '}
              <code>og:image</code> (your Cloudinary poster). You can also copy the direct image URL.
            </p>
            <p className="interruptions-admin-share-line">
              <span className="interruptions-admin-share-label">Share (HTML / OG)</span>
              <code className="interruptions-admin-share-url">{apiUrl(`/api/share/interruption/${editingId}`)}</code>
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--secondary"
                onClick={() => {
                  const u = apiUrl(`/api/share/interruption/${editingId}`);
                  navigator.clipboard?.writeText(u).catch(() => {});
                }}
              >
                Copy
              </button>
            </p>
            {form.posterImageUrl && String(form.posterImageUrl).trim().startsWith('http') ? (
              <p className="interruptions-admin-share-line">
                <span className="interruptions-admin-share-label">Direct image</span>
                <code className="interruptions-admin-share-url">{String(form.posterImageUrl).trim()}</code>
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--secondary"
                  onClick={() => {
                    const u = String(form.posterImageUrl).trim();
                    navigator.clipboard?.writeText(u).catch(() => {});
                  }}
                >
                  Copy
                </button>
              </p>
            ) : null}
          </div>
        )}

        {advisoryArchived && (
          <div className="interruptions-admin-callout interruptions-admin-callout--warn" role="status">
            <strong>Archived</strong> — view only.
          </div>
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
