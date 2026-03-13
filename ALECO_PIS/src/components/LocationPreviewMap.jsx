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

const LocationPreviewMap = ({ latitude, longitude, accuracy, municipality, district }) => {
    if (!latitude || !longitude) return null;

    const userPosition = [latitude, longitude];

    return (
        <div className="location-preview-container">
            <div className="location-preview-header">
                <h4>📍 Your Detected Location</h4>
                <div className="location-metadata">
                    <span className="municipality-badge">
                        {municipality || 'Detecting...'}
                    </span>
                    {district && (
                        <span className="district-badge">
                            {district}
                        </span>
                    )}
                    <span className="accuracy-badge">±{accuracy}m accuracy</span>
                </div>
            </div>

            <div className="map-preview-wrapper">
                <MapContainer 
                    center={userPosition} 
                    zoom={16} 
                    scrollWheelZoom={false}
                    zoomControl={true}
                    style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                >
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        attribution='&copy; OpenStreetMap contributors' 
                    />
                    
                    <MapCenterHandler coords={userPosition} />

                    <Marker position={userPosition} icon={getUserLocationIcon()}>
                    </Marker>
                </MapContainer>
            </div>

            <div className="location-preview-footer">
                <p className="location-hint">
                    ℹ️ This is your device's GPS location. Make sure it matches your actual position before submitting.
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
