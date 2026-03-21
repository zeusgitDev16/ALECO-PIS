/**
 * Dynamic feeder config: add areas/feeders without touching form logic.
 * Stored value format: "Bitano Feeder 1", "Salvacion SMF1", etc.
 */

export const FEEDER_AREAS = [
  { id: 'bitano', label: 'Bitano', feeders: ['1', '2', '3', '4'] },
  { id: 'washington', label: 'Washington', feeders: ['1', '2', '3', '4'] },
  { id: 'ligao', label: 'Ligao', feeders: ['1', '2', '3', '4'] },
  { id: 'polangui', label: 'Polangui', feeders: ['1', '2', '3', '4'] },
  { id: 'tabaco', label: 'Tabaco', feeders: ['1', '2', '3', '4'] },
  { id: 'malinao', label: 'Malinao', feeders: ['1', '2', '3', '4'] },
  { id: 'salvacion', label: 'Salvacion', feeders: ['SMF1', 'SMF2', '3', '4'] },
];

export const OTHER_AREA_ID = 'other';

/**
 * Build stored feeder value from area and feeder selection.
 * @param {string} areaId - area id (e.g. 'bitano') or OTHER_AREA_ID
 * @param {string} feederValue - feeder number/label (e.g. '1', 'SMF1') or custom text when Other
 * @returns {string}
 */
export function getFeederDisplayValue(areaId, feederValue) {
  if (!areaId || !feederValue || !String(feederValue).trim()) return '';
  if (areaId === OTHER_AREA_ID) return String(feederValue).trim();
  const area = FEEDER_AREAS.find((a) => a.id === areaId);
  if (!area) return '';
  return `${area.label} Feeder ${feederValue}`.trim();
}

/**
 * Parse API feeder string to { areaId, feederValue } for pre-selection.
 * Handles: "Bitano Feeder 1", "Salvacion SMF1", "Bitano 1", legacy free text.
 * @param {string} feederString - value from API/row
 * @returns {{ areaId: string, feederValue: string, isOther: boolean }}
 */
export function parseFeederFromApi(feederString) {
  const raw = feederString && String(feederString).trim();
  if (!raw) return { areaId: '', feederValue: '', isOther: true };

  for (const area of FEEDER_AREAS) {
    const prefix1 = `${area.label} Feeder `;
    const prefix2 = `${area.label} `;
    if (raw.startsWith(prefix1)) {
      const feederValue = raw.slice(prefix1.length).trim();
      if (feederValue && area.feeders.includes(feederValue)) {
        return { areaId: area.id, feederValue, isOther: false };
      }
    }
    if (raw.startsWith(prefix2)) {
      const feederValue = raw.slice(prefix2.length).trim();
      if (feederValue && area.feeders.includes(feederValue)) {
        return { areaId: area.id, feederValue, isOther: false };
      }
    }
  }

  return { areaId: OTHER_AREA_ID, feederValue: raw, isOther: true };
}
