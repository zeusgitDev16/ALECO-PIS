import React, { useEffect, useState } from 'react';
import { ALECO_SCOPE } from '../../alecoScope'; // Ensure this path is correct
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../CSS/CoverageMap.css';

// --- ENTERPRISE CUSTOM ICONS ---
const getStatusIcon = (status) => {
    let colorClass = 'pin-blue'; 
    if (status?.toLowerCase() === 'pending') colorClass = 'pin-orange';
    if (status?.toLowerCase() === 'resolved') colorClass = 'pin-green';

    return L.divIcon({
        className: 'custom-status-icon',
        html: `<div class="pulse-ring ${colorClass}"></div><div class="core-dot ${colorClass}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
};

// --- INVISIBLE MAP FLY HANDLER ---
const MapFlyHandler = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (targetCoords) {
            map.flyTo(targetCoords, 16, { duration: 1.5 }); 
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

    // --- HELPER: CLEAN BARANGAY NAMES ---
    // This strips "Barangay 47 - " and "(Poblacion)" so "Arimbay" matches "Arimbay"
    const getCleanName = (name) => {
        let clean = name.toLowerCase();
        if (clean.includes('-') && clean.includes('barangay')) {
            clean = clean.split('-')[1]; // Takes the part after the dash
        }
        clean = clean.replace(/\s*\(poblacion\)/g, ''); // Removes (Poblacion)
        return clean.trim();
    };

    // --- HELPER: GET TOWN CENTER ---
    const getTownCenter = (muni) => {
        const poblacion = muni.barangays.find(b => b.name.toLowerCase().includes('poblacion')) || muni.barangays[0];
        return [poblacion.lat || 13.1353, poblacion.lng || 123.7443];
    };

    // --- SEARCH LOGIC ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }

        const matched = [];
        ALECO_SCOPE.forEach(district => {
            district.municipalities.forEach(muni => {
                if (muni.name.toLowerCase().includes(val.toLowerCase())) {
                    matched.push({ name: muni.name, coords: getTownCenter(muni), type: 'Municipality' });
                }
                muni.barangays.forEach(brgy => {
                    const cleanBrgy = getCleanName(brgy.name);
                    if (cleanBrgy.includes(val.toLowerCase()) || brgy.name.toLowerCase().includes(val.toLowerCase())) {
                        matched.push({ 
                            name: brgy.name, 
                            muni: muni.name, 
                            coords: brgy.lat ? [brgy.lat, brgy.lng] : getTownCenter(muni), 
                            type: 'Barangay' 
                        });
                    }
                });
            });
        });
        setSearchResults(matched.slice(0, 5));
    };

    const selectLocation = (coords) => {
        setFlyTarget(coords); 
        setSearchQuery("");
        setSearchResults([]);
    };

    // --- BULLETPROOF LOCATION FINDER & JITTER ---
    const getTicketPosition = (locationString, ticketId) => {
        let jitterX = 0;
        let jitterY = 0;
        const safeId = ticketId ? String(ticketId) : String(Math.random());
        
        let hash = 0;
        for (let i = 0; i < safeId.length; i++) {
            hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
        }
        jitterX = (hash % 100) * 0.00015; 
        jitterY = ((hash >> 2) % 100) * 0.00015;

        // Ultimate Inland Fallback (Albay Capitol Area - Safe from water)
        const INLAND_LEGAZPI = [13.1353, 123.7443];

        if (!locationString || typeof locationString !== 'string') {
            return [INLAND_LEGAZPI[0] + jitterX, INLAND_LEGAZPI[1] + jitterY]; 
        }

        const locLower = locationString.toLowerCase();
        let matchedMuni = null;

        // STEP 1: Identify the Municipality First
        for (const district of ALECO_SCOPE) {
            for (const muni of district.municipalities) {
                const cleanMuniName = muni.name.toLowerCase().replace(' city', '');
                if (locLower.includes(cleanMuniName)) {
                    matchedMuni = muni;
                    break;
                }
            }
            if (matchedMuni) break;
        }

        // STEP 2: Search strictly inside the confirmed town using Clean Names
        if (matchedMuni) {
            for (const brgy of matchedMuni.barangays) {
                const cleanBrgy = getCleanName(brgy.name);
                // Matches "arimbay" inside "arimbay, legazpi"
                if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy.lat && brgy.lng) {
                    return [brgy.lat + jitterX, brgy.lng + jitterY];
                }
            }
            const townCenter = getTownCenter(matchedMuni);
            return [townCenter[0] + jitterX, townCenter[1] + jitterY];
        }

        // STEP 3: Blind Search (If municipality was omitted)
        for (const district of ALECO_SCOPE) {
            for (const muni of district.municipalities) {
                for (const brgy of muni.barangays) {
                    const cleanBrgy = getCleanName(brgy.name);
                    if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy.lat && brgy.lng) {
                        return [brgy.lat + jitterX, brgy.lng + jitterY];
                    }
                }
            }
        }
        
        return [INLAND_LEGAZPI[0] + jitterX, INLAND_LEGAZPI[1] + jitterY]; 
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
                        center={[13.1353, 123.7443]} 
                        zoom={12} 
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                        
                        <MapFlyHandler targetCoords={flyTarget} />

                        {tickets.map(ticket => {
                            const position = getTicketPosition(ticket.location, ticket.ticket_id);
                            const icon = getStatusIcon(ticket.status);
                            
                            return (
                                <Marker key={ticket.ticket_id || Math.random()} position={position} icon={icon}>
                                    <Popup>
                                        <div className="map-popup">
                                            <span className="popup-id">{ticket.ticket_id}</span>
                                            <h4 className="popup-issue">{ticket.issue_type}</h4>
                                            <p className="popup-loc">📍 {ticket.location}</p>
                                            <div className="popup-footer">
                                                <span className={`status-badge ${ticket.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default CoverageMap;