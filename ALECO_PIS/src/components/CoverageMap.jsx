import React, { useEffect, useState } from 'react';
import { ALECO_SCOPE } from '../data/alecoScope';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../CSS/CoverageMap.css';

// Fix for default Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MUNI_COORDS = {
    "Bacacay": [13.2934, 123.7891], "Malilipot": [13.3218, 123.7297],
    "Malinao": [13.4111, 123.7022], "Santo Domingo": [13.2338, 123.7758],
    "Tabaco City": [13.3618, 123.7272], "Tiwi": [13.4569, 123.6792],
    "Camalig": [13.1892, 123.6331], "Daraga": [13.1492, 123.6911],
    "Legazpi City": [13.1391, 123.7438], "Manito": [13.1211, 123.8683],
    "Rapu-Rapu": [13.1895, 124.1250], "Guinobatan": [13.1906, 123.5983],
    "Jovellar": [13.0658, 123.6014], "Libon": [13.3014, 123.4425],
    "Ligao City": [13.2386, 123.5350], "Oas": [13.2581, 123.4939],
    "Pio Duran": [13.0306, 123.4550], "Polangui": [13.2936, 123.4853]
};

// --- SEARCH ENGINE COMPONENT ---
// This component stays inside MapContainer to access 'useMap', 
// but it executes the 'flyTo' logic based on the external search state.
const MapFlyHandler = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (targetCoords) {
            map.flyTo(targetCoords, 15, { duration: 1.5 });
        }
    }, [targetCoords, map]);
    return null;
};

const CoverageMap = ({ isOpen, onClose, tickets = [] }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [flyTarget, setFlyTarget] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 250);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- SEARCH LOGIC ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }

        const matched = [];
        ALECO_SCOPE.forEach(district => {
            district.municipalities.forEach(muni => {
                if (muni.name.toLowerCase().includes(val.toLowerCase())) {
                    matched.push({ name: muni.name, coords: MUNI_COORDS[muni.name], type: 'Municipality' });
                }
                muni.barangays.forEach(brgy => {
                    if (brgy.name.toLowerCase().includes(val.toLowerCase())) {
                        matched.push({ 
                            name: brgy.name, 
                            muni: muni.name, 
                            coords: brgy.lat ? [brgy.lat, brgy.lng] : MUNI_COORDS[muni.name], 
                            type: 'Barangay' 
                        });
                    }
                });
            });
        });
        setSearchResults(matched.slice(0, 5));
    };

    const selectLocation = (coords) => {
        setFlyTarget(coords); // Trigger the FlyHandler inside MapContainer
        setSearchQuery("");
        setSearchResults([]);
    };

    const getTicketPosition = (locationString) => {
        if (!locationString) return MUNI_COORDS["Legazpi City"];
        const parts = locationString.split(',').map(p => p.trim().toLowerCase());
        const brgyTarget = parts[0];

        for (const district of ALECO_SCOPE) {
            for (const muni of district.municipalities) {
                const foundBrgy = muni.barangays.find(b => 
                    brgyTarget.includes(b.name.toLowerCase()) || 
                    b.name.toLowerCase().includes(brgyTarget.replace('brgy ', ''))
                );
                if (foundBrgy && foundBrgy.lat && foundBrgy.lng) return [foundBrgy.lat, foundBrgy.lng];
            }
        }
        for (const muniName in MUNI_COORDS) {
            if (locationString.toLowerCase().includes(muniName.toLowerCase())) return MUNI_COORDS[muniName];
        }
        return MUNI_COORDS["Legazpi City"]; 
    };

    return (
        <div className="map-modal-overlay" onClick={onClose}>
            <div className="map-modal-content" onClick={e => e.stopPropagation()}>
                <div className="map-modal-header">
                    <div className="header-titles">
                        <h3>🌐 ALECO Live Coverage Map</h3>
                        <p className="map-subtitle">Tracking {tickets.length} active incidents</p>
                    </div>

                    <div className="header-actions">
                        <div className="map-search-container">
                            <input 
                                type="text" 
                                placeholder="🔍 Search Barangay..." 
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                            {searchResults.length > 0 && (
                                <ul className="search-results-list">
                                    {searchResults.map((res, i) => (
                                        <li key={i} onClick={() => selectLocation(res.coords)}>
                                            <strong>{res.name}</strong> 
                                            <small>{res.type === 'Barangay' ? ` (${res.muni})` : ''}</small>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <button className="close-x" onClick={onClose}>&times;</button>
                    </div>
                </div>
                
                <div className="map-container-wrapper">
                    <MapContainer 
                        center={[13.1391, 123.7438]} 
                        zoom={11} 
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                        
                        {/* Invisible logic component to handle 'flyTo' animations */}
                        <MapFlyHandler targetCoords={flyTarget} />

                        {tickets.map(ticket => (
                            <Marker key={ticket.ticket_id} position={getTicketPosition(ticket.location)}>
                                <Popup>
                                    <div className="map-popup">
                                        <span className="popup-id">{ticket.ticket_id}</span>
                                        <h4 className="popup-issue">{ticket.issue_type}</h4>
                                        <p className="popup-loc">📍 {ticket.location}</p>
                                        <div className="popup-footer">
                                            <span className={`status-badge ${ticket.status?.toLowerCase().replace(/\s+/g, '-')}`}>{ticket.status}</span>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default CoverageMap;