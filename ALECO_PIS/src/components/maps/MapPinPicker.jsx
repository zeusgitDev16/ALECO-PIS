import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getPinIcon = () =>
  L.divIcon({
    className: 'report-map-pin-icon',
    html: '<div class="report-map-pin-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const MapClickHandler = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const MapInvalidateSizeOnMount = () => {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const MapPinPicker = ({ initialLat, initialLng, onConfirm, onCancel }) => {
  const safeLat = useMemo(() => {
    const n = Number(initialLat);
    return Number.isFinite(n) ? clamp(n, -90, 90) : 13.1353;
  }, [initialLat]);

  const safeLng = useMemo(() => {
    const n = Number(initialLng);
    return Number.isFinite(n) ? clamp(n, -180, 180) : 123.7443;
  }, [initialLng]);

  const [picked, setPicked] = useState([safeLat, safeLng]);

  useEffect(() => {
    setPicked([safeLat, safeLng]);
  }, [safeLat, safeLng]);

  return (
    <div className="report-map-picker-overlay" role="dialog" aria-modal="true">
      <div className="report-map-picker-modal">
        <div className="report-map-picker-header">
          <div className="report-map-picker-title-block">
            <h3 className="report-map-picker-title">Pin Location on Map</h3>
            <p className="report-map-picker-subtitle">
              Tap the map to move the pin, or drag it to the exact spot.
            </p>
          </div>
          <button type="button" className="report-map-picker-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="report-map-picker-body">
          <div className="report-map-picker-map">
            <MapContainer center={picked} zoom={16} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <MapInvalidateSizeOnMount />
              <MapClickHandler onPick={setPicked} />
              <Marker
                position={picked}
                draggable
                icon={getPinIcon()}
                eventHandlers={{
                  dragend: (e) => {
                    const ll = e?.target?.getLatLng?.();
                    if (!ll) return;
                    setPicked([ll.lat, ll.lng]);
                  },
                }}
              />
            </MapContainer>
          </div>

          <div className="report-map-picker-coords">
            <span className="report-map-picker-coords-label">Selected:</span>
            <span className="report-map-picker-coords-value">
              {picked[0].toFixed(6)}, {picked[1].toFixed(6)}
            </span>
          </div>
        </div>

        <div className="report-map-picker-actions">
          <button type="button" className="report-map-picker-btn report-map-picker-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="report-map-picker-btn report-map-picker-btn--confirm"
            onClick={() => onConfirm(picked[0], picked[1])}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPinPicker;
