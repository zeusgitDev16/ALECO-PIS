import React, { useEffect, useState, useRef } from 'react';
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
    let colorClass = 'pin-purple';
    const statusLower = status?.toLowerCase() || '';

    if (statusLower === 'pending') colorClass = 'pin-orange';
    else if (statusLower === 'ongoing') colorClass = 'pin-blue';
    else if (statusLower === 'restored') colorClass = 'pin-green';
    else if (statusLower === 'unresolved') colorClass = 'pin-red';
    else if (statusLower === 'nofaultfound') colorClass = 'pin-yellow';
    else if (statusLower === 'accessdenied') colorClass = 'pin-red';
    else if (statusLower === 'onhold') colorClass = 'pin-gray';

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
            const coords = targetCoords.coords || targetCoords;
            const zoom = targetCoords.zoom || 16;
            map.flyTo(coords, zoom, { duration: 1.5 });
        }
    }, [targetCoords, map]);
    return null;
};

const CoverageMap = ({ isOpen, onClose, tickets = [] }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [flyTarget, setFlyTarget] = useState(null);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const markerRefs = useRef({});
    const clusterGroupRef = useRef(null);

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

    // --- SEARCH LOGIC (Ticket ID Search) ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 1) { setSearchResults([]); return; }

        const needle = val.toLowerCase();
        const matched = tickets.filter(ticket => {
            const ticketId = String(ticket.ticket_id || '').toLowerCase();
            return ticketId.includes(needle);
        }).slice(0, 5);

        setSearchResults(matched);
    };

    const selectTicket = (ticket) => {
        setSearchQuery("");
        setSearchResults([]);
        setSelectedTicketId(ticket.ticket_id);

        // Get marker from refs (reliable direct reference)
        const storedMarker = markerRefs.current[ticket.ticket_id];

        // Access underlying Leaflet marker - try multiple properties
        let leafletMarker = storedMarker;
        if (storedMarker) {
            // Try to get the actual Leaflet marker instance
            leafletMarker = storedMarker._leaflet_element || storedMarker._leaflet || storedMarker;
        }

        if (leafletMarker && clusterGroupRef.current) {
            const clusterGroup = clusterGroupRef.current;

            // Access underlying Leaflet cluster group - try multiple properties
            const leafletClusterGroup = clusterGroup._leaflet_element ||
                                        clusterGroup._leaflet ||
                                        clusterGroup._markerClusterGroup ||
                                        clusterGroup.layer ||
                                        clusterGroup;

            // Spiderfy cluster if marker is inside one
            if (leafletClusterGroup && leafletClusterGroup.getVisibleParent) {
                const parentCluster = leafletClusterGroup.getVisibleParent(leafletMarker);
                if (parentCluster && parentCluster !== leafletMarker && parentCluster.spiderfy) {
                    parentCluster.spiderfy();
                }
            }

            // Get actual marker position (not jittered calculation)
            let coords;
            if (leafletMarker.getLatLng) {
                const markerPosition = leafletMarker.getLatLng();
                coords = [markerPosition.lat, markerPosition.lng];
            } else {
                // Fallback to calculated position
                coords = getTicketPosition(ticket);
            }

            // Fly to marker position at high zoom
            setFlyTarget({ coords, zoom: 18 });

            // Wait for flyTo animation (1.5s) + spiderfy buffer, then open popup
            setTimeout(() => {
                if (leafletMarker.openPopup) {
                    leafletMarker.openPopup();
                }
            }, 1600);
        } else {
            // Fallback: use calculated position
            const position = getTicketPosition(ticket);
            setFlyTarget({ coords: position, zoom: 18 });
        }
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
                                placeholder="🔍 Search Ticket ID..." 
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                            {searchResults.length > 0 && (
                                <ul className="search-results-list">
                                    {searchResults.map((ticket, i) => (
                                        <li key={i} onClick={() => selectTicket(ticket)}>
                                            <strong>{ticket.ticket_id}</strong>
                                            <small>{ticket.status ? ` - ${ticket.status}` : ''}</small>
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
                            ref={clusterGroupRef}
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
                                    <Marker
                                        key={ticket.ticket_id || Math.random()}
                                        position={position}
                                        icon={icon}
                                        ref={(marker) => {
                                            if (marker) {
                                                // Access underlying Leaflet marker instance
                                                // In react-leaflet v4, the Leaflet instance is available on the component
                                                const leafletMarker = marker._leaflet_element || marker;
                                                markerRefs.current[ticket.ticket_id] = leafletMarker;
                                            }
                                        }}
                                    >
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
