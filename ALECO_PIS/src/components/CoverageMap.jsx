import React, { useEffect, useState } from 'react';
import { ALECO_SCOPE } from '../../alecoScope'; // Ensure this path is correct
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '../CSS/CoverageMap.css';

// --- ENTERPRISE CUSTOM ICONS ---
const getStatusIcon = (status) => {
    let colorClass = 'pin-blue'; 
    if (status?.toLowerCase() === 'pending') colorClass = 'pin-orange';
    if (status?.toLowerCase() === 'restored') colorClass = 'pin-green';

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
        if (muni && muni.lat && muni.lng) return [muni.lat, muni.lng];
        if (muni && Array.isArray(muni.barangays) && muni.barangays.length > 0) {
            const poblacion =
                muni.barangays.find(b => String(b?.name || '').toLowerCase().includes('poblacion')) ||
                muni.barangays[0];
            if (poblacion?.lat && poblacion?.lng) return [poblacion.lat, poblacion.lng];
        }
        return [13.1353, 123.7443];
    };

    // --- SEARCH LOGIC ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }

        const matched = [];
        const needle = val.toLowerCase();
        ALECO_SCOPE.forEach(district => {
            (district.municipalities || []).forEach(muni => {
                const muniName = String(muni?.name || '');
                const muniGoogleName = String(muni?.googleName || '');
                if (muniName.toLowerCase().includes(needle) || muniGoogleName.toLowerCase().includes(needle)) {
                    matched.push({ name: muniName || muniGoogleName, coords: getTownCenter(muni), type: 'Municipality' });
                }

                if (Array.isArray(muni.barangays)) {
                    muni.barangays.forEach(brgy => {
                        const brgyName = String(brgy?.name || '');
                        const cleanBrgy = getCleanName(brgyName || '');
                        if (cleanBrgy.includes(needle) || brgyName.toLowerCase().includes(needle)) {
                            matched.push({ 
                                name: brgyName, 
                                muni: muniName, 
                                coords: brgy?.lat && brgy?.lng ? [brgy.lat, brgy.lng] : getTownCenter(muni), 
                                type: 'Barangay' 
                            });
                        }
                    });
                }
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
    const getTicketPosition = (ticket) => {
        let jitterX = 0;
        let jitterY = 0;
        const safeId = ticket.ticket_id ? String(ticket.ticket_id) : String(Math.random());
        
        let hash = 0;
        for (let i = 0; i < safeId.length; i++) {
            hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
        }
        jitterX = (hash % 100) * 0.00015; 
        jitterY = ((hash >> 2) % 100) * 0.00015;

        // Ultimate Inland Fallback (Albay Capitol Area - Safe from water)
        const INLAND_LEGAZPI = [13.1353, 123.7443];

        // --- NEW: PRECISE COORDINATE PRIORITY ---
        // If the ticket has explicit GPS or map-pin coordinates, use them!
        if (ticket.reported_lat != null && ticket.reported_lng != null) {
            const lat = Number(ticket.reported_lat);
            const lng = Number(ticket.reported_lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return [lat, lng];
            }
        }

        const locationString = ticket.location || [ticket.address, ticket.municipality, ticket.district].filter(Boolean).join(', ');

        if (!locationString || typeof locationString !== 'string') {
            return [INLAND_LEGAZPI[0] + jitterX, INLAND_LEGAZPI[1] + jitterY]; 
        }

        const locLower = locationString.toLowerCase();
        let matchedMuni = null;

        // STEP 1: Identify the Municipality First
        for (const district of ALECO_SCOPE) {
            for (const muni of (district.municipalities || [])) {
                const muniName = String(muni?.name || '').toLowerCase();
                const muniGoogleName = String(muni?.googleName || '').toLowerCase();
                const cleanMuniName = muniName.replace(' city', '').trim();
                const cleanGoogle = muniGoogleName.replace(' city', '').trim();
                if ((cleanMuniName && locLower.includes(cleanMuniName)) || (cleanGoogle && locLower.includes(cleanGoogle))) {
                    matchedMuni = muni;
                    break;
                }
            }
            if (matchedMuni) break;
        }

        // STEP 2: Search strictly inside the confirmed town using Clean Names
        if (matchedMuni) {
            if (Array.isArray(matchedMuni.barangays)) {
                for (const brgy of matchedMuni.barangays) {
                    const cleanBrgy = getCleanName(String(brgy?.name || ''));
                    if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy?.lat && brgy?.lng) {
                        return [brgy.lat + jitterX, brgy.lng + jitterY];
                    }
                }
            }
            const townCenter = getTownCenter(matchedMuni);
            return [townCenter[0] + jitterX, townCenter[1] + jitterY];
        }

        // STEP 3: Blind Search (If municipality was omitted)
        for (const district of ALECO_SCOPE) {
            for (const muni of (district.municipalities || [])) {
                if (!Array.isArray(muni.barangays)) continue;
                for (const brgy of muni.barangays) {
                    const cleanBrgy = getCleanName(String(brgy?.name || ''));
                    if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy?.lat && brgy?.lng) {
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
                                placeholder="🔍 Search Municipality / Barangay..." 
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

                        <MarkerClusterGroup
                            chunkedLoading
                            spiderfyOnMaxZoom
                            showCoverageOnHover={false}
                            removeOutsideVisibleBounds
                        >
                            {tickets.map(ticket => {
                                const position = getTicketPosition(ticket);
                                const icon = getStatusIcon(ticket.status);
                                const locationText = ticket.location || [ticket.address, ticket.municipality, ticket.district].filter(Boolean).join(', ') || '—';
                                const issueText = ticket.issue_type || ticket.category || '—';
                                const hasPrecise = ticket.reported_lat != null && ticket.reported_lng != null;
                                const lat = hasPrecise ? Number(ticket.reported_lat) : null;
                                const lng = hasPrecise ? Number(ticket.reported_lng) : null;
                                
                                return (
                                    <Marker key={ticket.ticket_id || Math.random()} position={position} icon={icon}>
                                        <Popup>
                                            <div className="map-popup">
                                                <span className="popup-id">{ticket.ticket_id}</span>
                                                <h4 className="popup-issue">{issueText}</h4>
                                                <p className="popup-loc">📍 {locationText}</p>
                                                <p className="popup-loc">
                                                    {hasPrecise && Number.isFinite(lat) && Number.isFinite(lng)
                                                        ? `🧭 ${lat.toFixed(6)}, ${lng.toFixed(6)}`
                                                        : '🧭 No precise coordinates'}
                                                </p>
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
                        </MarkerClusterGroup>
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default CoverageMap;
