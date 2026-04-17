import React, { useRef } from 'react';
import PropTypes from 'prop-types';

function SearchIcon() {
  return (
    <svg className="service-memo-strip-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
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

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Reference layout: title row + Acc#/Memo# + Name + Address + Ticket row.
 * variant: input (create) | search (update) | display (view)
 */
const ServiceMemoTopStrip = ({
  variant,
  values,
  onChange,
  onLoadTicket,
  onSearchField,
  loadError,
  searchBusy,
  disabled,
  photoUrl,
  onPhotoChange,
  onPhotoRemove,
}) => {
  const v = values || {};
  const isInput = variant === 'input';
  const isSearch = variant === 'search';
  const isDisplay = variant === 'display';
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
        <div className="service-memo-strip-row-two">
          {isDisplay ? (
            <>
              <div className="service-memo-form-strip-field">
                <label>Acct #</label>
                <div className="service-memo-strip-display">{v.account_number || '—'}</div>
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
                ) : (
                  <div className="service-memo-strip-search-wrap">
                    <input
                      id="strip-account"
                      type="text"
                      value={v.account_number ?? ''}
                      onChange={(e) => onChange?.('account_number', e.target.value)}
                      placeholder="Account #"
                      disabled={disabled || searchBusy}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onSearchField?.('account_number');
                        }
                      }}
                    />
                    <button type="button" className="service-memo-strip-icon-btn" title="Search" disabled={disabled || searchBusy} onClick={() => onSearchField?.('account_number')}>
                      <SearchIcon />
                    </button>
                  </div>
                )}
              </div>
              <div className="service-memo-form-strip-field">
                <label htmlFor="strip-memo">Memo #</label>
                {isInput ? (
                  <input
                    id="strip-memo"
                    type="text"
                    readOnly
                    value={v.control_number || ''}
                    placeholder="Assigned on save"
                    className="service-memo-strip-readonly-placeholder"
                  />
                ) : (
                  <div className="service-memo-strip-search-wrap">
                    <input
                      id="strip-memo"
                      type="text"
                      value={v.memo_query ?? ''}
                      onChange={(e) => onChange?.('memo_query', e.target.value)}
                      placeholder="SM-YYYY-NNNN"
                      disabled={disabled || searchBusy}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onSearchField?.('memo_query');
                        }
                      }}
                    />
                    <button type="button" className="service-memo-strip-icon-btn" title="Search memo" disabled={disabled || searchBusy} onClick={() => onSearchField?.('memo_query')}>
                      <SearchIcon />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="service-memo-form-strip-field service-memo-form-strip-field--wide">
          <label htmlFor="strip-name">Name</label>
          {isDisplay ? (
            <div className="service-memo-strip-display">{v.customer_name || '—'}</div>
          ) : isInput ? (
            <input
              id="strip-name"
              type="text"
              value={v.customer_name ?? ''}
              onChange={(e) => onChange?.('customer_name', e.target.value)}
              placeholder="Customer name"
              disabled={disabled}
              autoComplete="off"
            />
          ) : (
            <div className="service-memo-strip-search-wrap">
              <input
                id="strip-name"
                type="text"
                value={v.customer_name ?? ''}
                onChange={(e) => onChange?.('customer_name', e.target.value)}
                placeholder="Customer name"
                disabled={disabled || searchBusy}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchField?.('customer_name');
                  }
                }}
              />
              <button type="button" className="service-memo-strip-icon-btn" title="Search" disabled={disabled || searchBusy} onClick={() => onSearchField?.('customer_name')}>
                <SearchIcon />
              </button>
            </div>
          )}
        </div>

        <div className="service-memo-form-strip-field service-memo-form-strip-field--wide">
          <label htmlFor="strip-address">Address</label>
          {isDisplay ? (
            <div className="service-memo-strip-display">{v.address || '—'}</div>
          ) : isInput ? (
            <input
              id="strip-address"
              type="text"
              value={v.address ?? ''}
              onChange={(e) => onChange?.('address', e.target.value)}
              placeholder="Address"
              disabled={disabled}
              autoComplete="off"
            />
          ) : (
            <div className="service-memo-strip-search-wrap">
              <input
                id="strip-address"
                type="text"
                value={v.address ?? ''}
                onChange={(e) => onChange?.('address', e.target.value)}
                placeholder="Address"
                disabled={disabled || searchBusy}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchField?.('address');
                  }
                }}
              />
              <button type="button" className="service-memo-strip-icon-btn" title="Search" disabled={disabled || searchBusy} onClick={() => onSearchField?.('address')}>
                <SearchIcon />
              </button>
            </div>
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
                  <button type="button" className="interruptions-admin-btn service-memo-strip-load-btn" onClick={onLoadTicket} disabled={disabled || searchBusy}>
                    Load
                  </button>
                </div>
              </div>
              {loadError && <span className="service-memo-inline-err service-memo-strip-load-err">{loadError}</span>}
            </>
          )}

          {isSearch && (
            <>
              <div className="service-memo-form-strip-field service-memo-form-strip-field--grow">
                <label htmlFor="strip-ticket-search">Ticket ID</label>
                <div className="service-memo-strip-search-wrap">
                  <input
                    id="strip-ticket-search"
                    type="text"
                    value={v.ticket_query ?? ''}
                    onChange={(e) => onChange?.('ticket_query', e.target.value)}
                    placeholder="Search by ticket ID…"
                    disabled={disabled || searchBusy}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSearchField?.('ticket_query');
                      }
                    }}
                  />
                  <button type="button" className="service-memo-strip-icon-btn" title="Search ticket" disabled={disabled || searchBusy} onClick={() => onSearchField?.('ticket_query')}>
                    <SearchIcon />
                  </button>
                </div>
              </div>
            </>
          )}

          {isDisplay && (
            <div className="service-memo-form-strip-field service-memo-form-strip-field--grow">
              <label>Ticket ID</label>
              <div className="service-memo-strip-display">{v.ticket_id || '—'}</div>
            </div>
          )}
        </div>

        {isSearch && loadError && <p className="service-memo-inline-err service-memo-strip-load-err">{loadError}</p>}
      </div>
    </div>
  );
};

ServiceMemoTopStrip.propTypes = {
  variant: PropTypes.oneOf(['input', 'search', 'display']).isRequired,
  values: PropTypes.object,
  onChange: PropTypes.func,
  onLoadTicket: PropTypes.func,
  onSearchField: PropTypes.func,
  loadError: PropTypes.string,
  searchBusy: PropTypes.bool,
  disabled: PropTypes.bool,
  photoUrl: PropTypes.string,
  onPhotoChange: PropTypes.func,
  onPhotoRemove: PropTypes.func,
};

export default ServiceMemoTopStrip;
