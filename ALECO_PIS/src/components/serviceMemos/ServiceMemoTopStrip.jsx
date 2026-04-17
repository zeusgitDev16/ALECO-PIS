import React, { useRef } from 'react';
import PropTypes from 'prop-types';

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/** Same info-circle glyph as Users → Invite status banners */
function MemoExistsInfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/**
 * Reference layout: title row + Acc#/Memo# + Name + Address + Ticket row.
 * variant: input (create) | display (view) | update (edit memo: locked reference + photo)
 */
const ServiceMemoTopStrip = ({
  variant,
  values,
  onChange,
  onLoadTicket,
  loadError,
  disabled,
  photoUrl,
  onPhotoChange,
  onPhotoRemove,
  onGenerateMemoCode,
  generateMemoBusy,
  canGenerateMemoNumber,
  memoAllocateError,
  ticketVerifyBusy,
  existingMemoNotice,
}) => {
  const v = values || {};
  const isInput = variant === 'input';
  const isDisplay = variant === 'display';
  const isUpdateStrip = variant === 'update';
  const fileInputRef = useRef(null);

  const handlePhotoClick = () => {
    if (!disabled && !isDisplay) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onPhotoChange?.(event.target.result, file);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    onPhotoRemove?.();
  };

  return (
    <div className="service-memo-reference-header">
      <div className="service-memo-reference-title-row">
        <span className="service-memo-reference-badge" aria-hidden />
        <h2 className="service-memo-reference-title">Service memo</h2>
        <div
          className={`service-memo-reference-photo ${!isDisplay && !disabled ? 'service-memo-reference-photo--interactive' : ''}`}
          onClick={handlePhotoClick}
          role={!isDisplay && !disabled ? 'button' : undefined}
          tabIndex={!isDisplay && !disabled ? 0 : undefined}
          aria-label={!isDisplay && !disabled ? 'Add or change photo' : 'Service memo photo'}
        >
          {photoUrl ? (
            <>
              <img src={photoUrl} alt="Service memo" className="service-memo-reference-photo-preview" />
              {!isDisplay && !disabled && (
                <button
                  type="button"
                  className="service-memo-reference-photo-remove"
                  onClick={handleRemovePhoto}
                  aria-label="Remove photo"
                >
                  <RemoveIcon />
                </button>
              )}
            </>
          ) : (
            <div className="service-memo-reference-photo-placeholder">
              {!isDisplay ? (
                <>
                  <CameraIcon />
                  <span className="service-memo-reference-photo-label">Add picture</span>
                  <span className="service-memo-reference-photo-hint">(optional)</span>
                </>
              ) : (
                <span className="service-memo-reference-photo-label">No picture</span>
              )}
            </div>
          )}
          {!isDisplay && !disabled && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className={`service-memo-form-top-strip service-memo-form-top-strip--${variant}`} data-variant={variant}>
        {isInput && existingMemoNotice ? (
          <div className="service-memo-status-banner service-memo-status--memo-exists" role="status">
            <MemoExistsInfoIcon />
            <span>{existingMemoNotice}</span>
          </div>
        ) : null}
        <div className="service-memo-strip-row-two">
          {isDisplay || isUpdateStrip ? (
            <>
              <div className="service-memo-form-strip-field">
                <label>Acct #</label>
                <div className="service-memo-strip-display">{v.account_number || '—'}</div>
                {isUpdateStrip && (
                  <p className="service-memo-strip-account-reminder">
                    Account numbers come from the linked ticket. To add or correct the consumer account number, edit the ticket in the ticket module—do not change it here.
                  </p>
                )}
              </div>
              <div className="service-memo-form-strip-field">
                <label>Memo #</label>
                <div className="service-memo-strip-display">{v.control_number || '—'}</div>
              </div>
            </>
          ) : (
            <>
              <div className="service-memo-form-strip-field">
                <label htmlFor="strip-account">Acct #</label>
                {isInput ? (
                  <input
                    id="strip-account"
                    type="text"
                    value={v.account_number ?? ''}
                    onChange={(e) => onChange?.('account_number', e.target.value)}
                    placeholder="Account #"
                    disabled={disabled}
                    autoComplete="off"
                  />
                ) : null}
              </div>
              <div className="service-memo-form-strip-field">
                <label htmlFor="strip-memo">Memo #</label>
                {isInput ? (
                  <div className="service-memo-strip-input-with-action">
                    <input
                      id="strip-memo"
                      type="text"
                      readOnly
                      value={v.control_number || ''}
                      placeholder="e.g. LEG-0000089729"
                      className="service-memo-strip-readonly-placeholder"
                      aria-describedby={memoAllocateError ? 'strip-memo-allocate-err' : undefined}
                    />
                    <button
                      type="button"
                      className="interruptions-admin-btn service-memo-strip-generate-btn"
                      onClick={() => onGenerateMemoCode?.()}
                      disabled={disabled || generateMemoBusy || ticketVerifyBusy || !canGenerateMemoNumber}
                      title={
                        existingMemoNotice
                          ? 'A service memo already exists for this ticket — open it from the list or delete it first.'
                          : ticketVerifyBusy
                            ? 'Verifying ticket ID…'
                            : !canGenerateMemoNumber
                              ? 'Enter full ticket ID and wait until it is verified'
                              : 'Preview next memo # (based on saved memos; stored when you Save)'
                      }
                    >
                      {generateMemoBusy ? '…' : 'Generate code'}
                    </button>
                  </div>
                ) : null}
                {isInput && (
                  <p className="service-memo-strip-memo-preview-hint">
                    Preview only—repeating Generate shows the same # until a memo is saved. The number is stored when you click Save.
                  </p>
                )}
                {isInput && memoAllocateError && (
                  <span id="strip-memo-allocate-err" className="service-memo-inline-err service-memo-strip-load-err" role="alert">
                    {memoAllocateError}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="service-memo-form-strip-field service-memo-form-strip-field--wide">
          <label htmlFor="strip-name">Name</label>
          {isDisplay || isUpdateStrip ? (
            <div className="service-memo-strip-display">{v.customer_name || '—'}</div>
          ) : (
            <input
              id="strip-name"
              type="text"
              value={v.customer_name ?? ''}
              onChange={(e) => onChange?.('customer_name', e.target.value)}
              placeholder="Customer name"
              disabled={disabled}
              autoComplete="off"
            />
          )}
        </div>

        <div className="service-memo-form-strip-field service-memo-form-strip-field--wide">
          <div className="service-memo-strip-address-label-row">
            <label htmlFor="strip-address">Address</label>
            {v.municipality ? (
              <span className="service-memo-strip-muni-from-ticket" title="Municipality from aleco_tickets — used for memo # prefix (e.g. LEG-…)">
                {v.municipality}
              </span>
            ) : null}
          </div>
          {isDisplay || isUpdateStrip ? (
            <div className="service-memo-strip-display">{v.address || '—'}</div>
          ) : (
            <input
              id="strip-address"
              type="text"
              value={v.address ?? ''}
              onChange={(e) => onChange?.('address', e.target.value)}
              placeholder="Street / location, municipality"
              disabled={disabled}
              autoComplete="off"
            />
          )}
        </div>

        <div className="service-memo-strip-row-ticket">
          {isInput && (
            <>
              <div className="service-memo-form-strip-field service-memo-form-strip-field--grow">
                <label htmlFor="strip-ticket_id">Ticket ID</label>
                <div className="service-memo-strip-input-with-action">
                  <input
                    id="strip-ticket_id"
                    type="text"
                    value={v.ticket_query ?? ''}
                    onChange={(e) => onChange?.('ticket_query', e.target.value)}
                    placeholder="e.g. ALECO-xxxxx"
                    disabled={disabled}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onLoadTicket?.();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="interruptions-admin-btn service-memo-strip-load-btn"
                    onClick={onLoadTicket}
                    disabled={disabled || ticketVerifyBusy}
                  >
                    {ticketVerifyBusy ? 'Checking…' : 'Load'}
                  </button>
                </div>
              </div>
              {ticketVerifyBusy && !loadError && <span className="service-memo-strip-verify-hint">Verifying ticket ID…</span>}
              {loadError && <span className="service-memo-inline-err service-memo-strip-load-err">{loadError}</span>}
            </>
          )}

          {(isDisplay || isUpdateStrip) && (
            <div className="service-memo-form-strip-field service-memo-form-strip-field--grow">
              <label>Ticket ID</label>
              <div className="service-memo-strip-display">{v.ticket_id || '—'}</div>
            </div>
          )}
        </div>

        {isInput && loadError && !ticketVerifyBusy && (
          <p className="service-memo-inline-err service-memo-strip-load-err">{loadError}</p>
        )}
      </div>
    </div>
  );
};

ServiceMemoTopStrip.propTypes = {
  variant: PropTypes.oneOf(['input', 'display', 'update']).isRequired,
  values: PropTypes.object,
  onChange: PropTypes.func,
  onLoadTicket: PropTypes.func,
  loadError: PropTypes.string,
  disabled: PropTypes.bool,
  photoUrl: PropTypes.string,
  onPhotoChange: PropTypes.func,
  onPhotoRemove: PropTypes.func,
  onGenerateMemoCode: PropTypes.func,
  generateMemoBusy: PropTypes.bool,
  canGenerateMemoNumber: PropTypes.bool,
  memoAllocateError: PropTypes.string,
  ticketVerifyBusy: PropTypes.bool,
  existingMemoNotice: PropTypes.string,
};

export default ServiceMemoTopStrip;
