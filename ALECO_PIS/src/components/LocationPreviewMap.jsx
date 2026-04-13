import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../CSS/LocationPreviewMap.css';

// --- GPS MARKER ICON (Pulsing Blue Dot) ---
const getUserLocationIcon = () => {
    return L.divIcon({
        className: 'user-location-marker',
        html: `
            <div class="pulse-ring-user"></div>
            <div class="core-dot-user"></div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
};

// --- AUTO-RESIZE MAP WHEN CONTAINER CHANGES SIZE ---
const MapResizeHandler = () => {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            map.invalidateSize();
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [map]);
    return null;
};

// --- AUTO-CENTER MAP ON USER LOCATION ---
const MapCenterHandler = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 16);
        }
    }, [coords, map]);
    return null;
};

const LocationPreviewMap = ({ latitude, longitude, accuracy, municipality, district, method }) => {
    if (!latitude || !longitude) return null;

    const userPosition = [latitude, longitude];

    const isPinned = method === 'map_pin';

    return (
        <div className="location-preview-container" key={method}>
            <div className={`location-preview-header${isPinned ? ' location-preview-header--pinned' : ''}`}>
                <h4>{isPinned ? '� Pinned Location' : '📍 Detected Location'}</h4>
                <div className="location-metadata">
                    <span className="municipality-badge">
                        {municipality || 'Detecting...'}
                    </span>
                    {district && (
                        <span className="district-badge">
                            {district}
                        </span>
                    )}
                    {!isPinned && accuracy != null && (
                        <span className="accuracy-badge">±{accuracy}m accuracy</span>
                    )}
                    {isPinned && (
                        <span className="accuracy-badge accuracy-badge--pinned">Manual pin</span>
                    )}
                </div>
            </div>

            <div className="map-preview-wrapper">
                <MapContainer 
                    center={userPosition} 
                    zoom={16} 
                    scrollWheelZoom={false}
                    zoomControl={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        attribution='&copy; OpenStreetMap contributors' 
                    />
                    
                    <MapCenterHandler coords={userPosition} />
                    <MapResizeHandler />

                    <Marker position={userPosition} icon={getUserLocationIcon()}>
                    </Marker>
                </MapContainer>
            </div>

            <div className="location-preview-footer">
                <p className="location-hint">
                    {isPinned
                        ? '✏️ Location set by manual pin. Confirm the pin is placed at the correct spot before submitting.'
                        : 'ℹ️ Location captured via device GPS. Verify it matches your actual position before submitting.'}
                </p>
                {district && municipality && (
                    <p className="location-confirmation">
                        ✅ Matched to: <strong>{municipality}</strong>, {district}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LocationPreviewMap;
