import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import {
  FEEDER_AREAS,
  OTHER_AREA_ID,
} from '../../config/feederConfig';

/**
 * Cascading feeder select: area dropdown → feeder dropdown.
 * When "Other" is selected, shows custom text input for legacy values.
 * Value is stored as single string (e.g. "Bitano Feeder 1", "Salvacion SMF1").
 */
export default function FeederCascadeSelect({ value, onChange, onFeederIdChange, disabled, id }) {
  const [areas, setAreas] = useState(() =>
    FEEDER_AREAS.map((a) => ({
      id: a.id,
      label: a.label,
      feeders: (a.feeders || []).map((f) => ({ id: null, code: String(f), label: String(f) })),
    }))
  );

  const parseFeederFromValue = (feederString, sourceAreas) => {
    const raw = feederString && String(feederString).trim();
    if (!raw) return { areaId: '', feederValue: '', isOther: true };

    for (const area of sourceAreas) {
      const prefix1 = `${area.label} Feeder `;
      const prefix2 = `${area.label} `;
      if (raw.startsWith(prefix1)) {
        const feederCode = raw.slice(prefix1.length).trim();
        const found = (area.feeders || []).some((f) => String(f.code) === feederCode);
        if (found) return { areaId: area.id, feederValue: feederCode, isOther: false };
      }
      if (raw.startsWith(prefix2)) {
        const feederCode = raw.slice(prefix2.length).trim();
        const found = (area.feeders || []).some((f) => String(f.code) === feederCode);
        if (found) return { areaId: area.id, feederValue: feederCode, isOther: false };
      }
    }

    return { areaId: OTHER_AREA_ID, feederValue: raw, isOther: true };
  };

  const getDisplayValue = (areaId, feederCode, sourceAreas) => {
    if (!areaId || !feederCode || !String(feederCode).trim()) return '';
    if (areaId === OTHER_AREA_ID) return String(feederCode).trim();
    const area = sourceAreas.find((a) => a.id === areaId);
    if (!area) return '';
    const found = (area.feeders || []).find((f) => String(f.code) === String(feederCode));
    if (found?.label && String(found.label).trim()) return String(found.label).trim();
    return `${area.label} Feeder ${feederCode}`.trim();
  };

  const parsed = parseFeederFromValue(value, areas);
  const [areaId, setAreaId] = useState(parsed.areaId || '');
  const [feederValue, setFeederValue] = useState(parsed.feederValue || '');
  const isOther = areaId === OTHER_AREA_ID;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/feeders'));
        const data = await res.json();
        if (cancelled || !res.ok || !data?.success || !Array.isArray(data.areas)) return;

        const mapped = data.areas
          .map((a) => ({
            id: String(a.code || '').trim(),
            label: String(a.label || '').trim(),
            feeders: Array.isArray(a.feeders)
              ? a.feeders
                  .map((f) => ({
                    id: f.id != null ? Number(f.id) : null,
                    code: String(f.code || '').trim(),
                    label: String(f.label || '').trim() || String(f.code || '').trim(),
                  }))
                  .filter((f) => f.code)
              : [],
          }))
          .filter((a) => a.id && a.label);

        if (mapped.length > 0) setAreas(mapped);
      } catch {
        // Keep local fallback FEEDER_AREAS.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const p = parseFeederFromValue(value, areas);
    setAreaId(p.areaId || '');
    setFeederValue(p.feederValue || '');
  }, [value, areas]);

  const handleAreaChange = (ev) => {
    const nextAreaId = ev.target.value;
    setAreaId(nextAreaId);
    setFeederValue('');
    if (nextAreaId === OTHER_AREA_ID) {
      onChange('');
      onFeederIdChange?.(null);
    } else {
      onChange('');
      onFeederIdChange?.(null);
    }
  };

  const handleFeederChange = (ev) => {
    const nextFeeder = ev.target.value;
    setFeederValue(nextFeeder);
    const stored = getDisplayValue(areaId, nextFeeder, areas);
    const found = selectedArea?.feeders?.find((f) => String(f.code) === String(nextFeeder));
    onChange(stored);
    onFeederIdChange?.(found?.id != null ? Number(found.id) : null);
  };

  const handleCustomChange = (ev) => {
    const custom = ev.target.value.trim();
    setFeederValue(ev.target.value);
    onChange(custom);
    onFeederIdChange?.(null);
  };

  const selectedArea = areas.find((a) => a.id === areaId);

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
          {areas.map((a) => (
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
              <option key={f.code} value={f.code}>
                {f.code}
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
