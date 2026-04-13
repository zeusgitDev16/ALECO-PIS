import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../CSS/TicketLocationMap.css';

const getPinIcon = () =>
    L.divIcon({
        className: 'tlm-pin-icon',
        html: `<div class="tlm-pin-pulse"></div><div class="tlm-pin-dot"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });

const ResizeHandler = () => {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const container = map.getContainer();
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(container);
        return () => ro.disconnect();
    }, [map]);
    return null;
};

const CenterHandler = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) map.setView(coords, 16);
    }, [coords, map]);
    return null;
};

const TicketLocationMap = ({ latitude, longitude, accuracy, municipality, district }) => {
    if (!latitude || !longitude) return null;

    const position = [latitude, longitude];
    const lat = Number(latitude).toFixed(6);
    const lng = Number(longitude).toFixed(6);

    return (
        <div className="tlm-container">
            <div className="tlm-header">
                <span className="tlm-title">📍 Reported Location</span>
            </div>

            <div className="tlm-map-wrapper">
                <MapContainer
                    center={position}
                    zoom={16}
                    scrollWheelZoom={false}
                    zoomControl={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />
                    <CenterHandler coords={position} />
                    <ResizeHandler />
                    <Marker position={position} icon={getPinIcon()} />
                </MapContainer>
            </div>

            <div className="tlm-footer">
                <span className="tlm-coords">
                    <span className="tlm-coords-label">Coordinates</span>
                    <span className="tlm-coords-value">{lat}, {lng}</span>
                </span>
                {accuracy != null && (
                    <span className="tlm-accuracy">±{accuracy}m</span>
                )}
            </div>
        </div>
    );
};

export default TicketLocationMap;
