import React, { useState, useEffect } from 'react';
import {
  FEEDER_AREAS,
  OTHER_AREA_ID,
  getFeederDisplayValue,
  parseFeederFromApi,
} from '../../config/feederConfig';

/**
 * Cascading feeder select: area dropdown → feeder dropdown.
 * When "Other" is selected, shows custom text input for legacy values.
 * Value is stored as single string (e.g. "Bitano Feeder 1", "Salvacion SMF1").
 */
export default function FeederCascadeSelect({ value, onChange, disabled, id }) {
  const parsed = parseFeederFromApi(value);
  const [areaId, setAreaId] = useState(parsed.areaId || '');
  const [feederValue, setFeederValue] = useState(parsed.feederValue || '');
  const isOther = areaId === OTHER_AREA_ID;

  useEffect(() => {
    const p = parseFeederFromApi(value);
    setAreaId(p.areaId || '');
    setFeederValue(p.feederValue || '');
  }, [value]);

  const handleAreaChange = (ev) => {
    const nextAreaId = ev.target.value;
    setAreaId(nextAreaId);
    setFeederValue('');
    if (nextAreaId === OTHER_AREA_ID) {
      onChange('');
    } else {
      onChange('');
    }
  };

  const handleFeederChange = (ev) => {
    const nextFeeder = ev.target.value;
    setFeederValue(nextFeeder);
    const stored = getFeederDisplayValue(areaId, nextFeeder);
    onChange(stored);
  };

  const handleCustomChange = (ev) => {
    const custom = ev.target.value.trim();
    setFeederValue(ev.target.value);
    onChange(custom);
  };

  const selectedArea = FEEDER_AREAS.find((a) => a.id === areaId);

  return (
    <div className="interruptions-admin-feeder-cascade">
      <div className="interruptions-admin-feeder-cascade-row">
        <select
          id={id}
          value={areaId}
          onChange={handleAreaChange}
          disabled={disabled}
          className="interruptions-admin-feeder-area-select"
          aria-label="Feeder area"
        >
          <option value="">Select area</option>
          {FEEDER_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
          <option value={OTHER_AREA_ID}>Other (custom)</option>
        </select>
        {!isOther && selectedArea && (
          <select
            value={feederValue}
            onChange={handleFeederChange}
            disabled={disabled}
            className="interruptions-admin-feeder-number-select"
            aria-label="Feeder number"
          >
            <option value="">Select feeder</option>
            {selectedArea.feeders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </div>
      {isOther && (
        <input
          type="text"
          value={feederValue}
          onChange={handleCustomChange}
          disabled={disabled}
          placeholder="Enter feeder name or ID"
          className="interruptions-admin-feeder-custom-input"
          aria-label="Custom feeder"
        />
      )}
    </div>
  );
}
