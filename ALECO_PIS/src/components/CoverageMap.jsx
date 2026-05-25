import React, { useEffect, useState, useRef, useMemo } from 'react';
import { toast } from 'react-toastify';
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
        try {
            if (targetCoords) {
                const coords = targetCoords.coords || targetCoords;
                const zoom = targetCoords.zoom || 16;
                if (map && map.flyTo && Array.isArray(coords) && coords.length === 2) {
                    map.flyTo(coords, zoom, { duration: 1.5 });
                }
            }
        } catch (error) {
            console.error('Error in MapFlyHandler:', error);
        }
    }, [targetCoords, map]);
    return null;
};

// --- MODULE-LEVEL HELPERS (stable across renders) ---
const INLAND_LEGAZPI = [13.1353, 123.7443];

const getCleanName = (name) => {
    let clean = name.toLowerCase();
    if (clean.includes('-') && clean.includes('barangay')) {
        clean = clean.split('-')[1];
    }
    clean = clean.replace(/\s*\(poblacion\)/g, '');
    return clean.trim();
};

const getTownCenter = (muni) => {
    if (muni && muni.lat && muni.lng) return [muni.lat, muni.lng];
    if (muni && Array.isArray(muni.barangays) && muni.barangays.length > 0) {
        const poblacion =
            muni.barangays.find(b => String(b?.name || '').toLowerCase().includes('poblacion')) ||
            muni.barangays[0];
        if (poblacion?.lat && poblacion?.lng) return [poblacion.lat, poblacion.lng];
    }
    return INLAND_LEGAZPI;
};

const computeTicketPosition = (ticket) => {
    try {
        let jitterX = 0;
        let jitterY = 0;
        const safeId = ticket.ticket_id ? String(ticket.ticket_id) : String(Math.random());

        let hash = 0;
        for (let i = 0; i < safeId.length; i++) {
            hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
        }
        jitterX = (hash % 100) * 0.00015;
        jitterY = ((hash >> 2) % 100) * 0.00015;

        // PRECISE COORDINATE PRIORITY
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

        if (matchedMuni) {
            if (Array.isArray(matchedMuni.barangays)) {
                for (const brgy of matchedMuni.barangays) {
                    const cleanBrgy = getCleanName(String(brgy?.name || ''));
                    if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy?.lat && brgy?.lng) {
                        const lat = Number(brgy.lat);
                        const lng = Number(brgy.lng);
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            return [lat + jitterX, lng + jitterY];
                        }
                    }
                }
            }
            const townCenter = getTownCenter(matchedMuni);
            const lat = Number(townCenter[0]);
            const lng = Number(townCenter[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return [lat + jitterX, lng + jitterY];
            }
        }

        for (const district of ALECO_SCOPE) {
            for (const muni of (district.municipalities || [])) {
                if (!Array.isArray(muni.barangays)) continue;
                for (const brgy of muni.barangays) {
                    const cleanBrgy = getCleanName(String(brgy?.name || ''));
                    if (cleanBrgy.length > 2 && locLower.includes(cleanBrgy) && brgy?.lat && brgy?.lng) {
                        const lat = Number(brgy.lat);
                        const lng = Number(brgy.lng);
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            return [lat + jitterX, lng + jitterY];
                        }
                    }
                }
            }
        }

        return [INLAND_LEGAZPI[0] + jitterX, INLAND_LEGAZPI[1] + jitterY];
    } catch (error) {
        console.error('Error computing ticket position:', error);
        return [13.1353, 123.7443];
    }
};

const CoverageMap = ({ isOpen, onClose, tickets = [] }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [flyTarget, setFlyTarget] = useState(null);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const markerRefs = useRef({});
    const clusterGroupRef = useRef(null);

    // Memoize valid tickets - stable reference across renders unless tickets prop changes
    const validTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const hasPrecise = ticket.reported_lat != null && ticket.reported_lng != null;
            const hasLocation = ticket.location || ticket.address || ticket.municipality;
            return hasPrecise || hasLocation;
        });
    }, [tickets]);

    // Memoize ticket positions - CRITICAL: stable array references prevent unnecessary
    // setLatLng calls in react-leaflet, which prevents the MarkerClusterGroup DistanceGrid
    // corruption that causes the crash.
    const ticketPositions = useMemo(() => {
        const map = new Map();
        for (const ticket of validTickets) {
            const position = computeTicketPosition(ticket);
            if (Array.isArray(position) && position.length === 2) {
                const lat = Number(position[0]);
                const lng = Number(position[1]);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    map.set(ticket.ticket_id, [lat, lng]);
                }
            }
        }
        return map;
    }, [validTickets]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 250);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- SEARCH LOGIC (Ticket ID Search) ---
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 1) { setSearchResults([]); return; }

        const needle = val.toLowerCase();
        const matched = validTickets.filter(ticket => {
            const ticketId = String(ticket.ticket_id || '').toLowerCase();
            return ticketId.includes(needle);
        }).slice(0, 5);

        setSearchResults(matched);
    };

    const selectTicket = (ticket) => {
        try {
            setSearchQuery("");
            setSearchResults([]);
            setSelectedTicketId(ticket.ticket_id);

            // Check if ticket has valid coordinates
            const hasPrecise = ticket.reported_lat != null && ticket.reported_lng != null;
            const hasLocation = ticket.location || ticket.address || ticket.municipality;
            
            if (!hasPrecise && !hasLocation) {
                // Close the modal and show toast
                onClose();
                toast.warning('Ticket does not have any pins on the map');
                return;
            }

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
                    // Fallback to memoized position
                    coords = ticketPositions.get(ticket.ticket_id) || INLAND_LEGAZPI;
                }

                // Fly to marker position at high zoom
                setFlyTarget({ coords, zoom: 18 });

                // Wait for flyTo animation (1.5s) + spiderfy buffer, then open popup
                setTimeout(() => {
                    try {
                        if (leafletMarker && leafletMarker.openPopup) {
                            leafletMarker.openPopup();
                        }
                    } catch (error) {
                        console.error('Error opening popup:', error);
                    }
                }, 1600);
            } else {
                // Fallback: use memoized position
                const position = ticketPositions.get(ticket.ticket_id) || INLAND_LEGAZPI;
                setFlyTarget({ coords: position, zoom: 18 });
            }
        } catch (error) {
            console.error('Error selecting ticket on map:', error);
            // Close modal and show toast on error
            onClose();
            toast.error('Unable to locate this ticket on the map. The ticket may not have valid location data.');
        }
    };

    return (
        <div className="map-modal-overlay" onClick={onClose}>
            <div className="map-modal-content" onClick={e => e.stopPropagation()}>
                <div className="map-modal-header">
                    <div className="header-titles">
                        <h3>🌐 ALECO Live Coverage Map</h3>
                        <p className="map-subtitle">Tracking {validTickets.length} active incidents on map</p>
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
                            {validTickets.map(ticket => {
                                try {
                                    // Use MEMOIZED position - same array reference across renders
                                    // This prevents react-leaflet from calling setLatLng on every render,
                                    // which prevents the MarkerClusterGroup DistanceGrid corruption crash.
                                    const position = ticketPositions.get(ticket.ticket_id);
                                    if (!position) {
                                        return null;
                                    }
                                    
                                    const icon = getStatusIcon(ticket.status);
                                    const locationText = ticket.location || [ticket.address, ticket.municipality, ticket.district].filter(Boolean).join(', ') || '—';
                                    const issueText = ticket.issue_type || ticket.category || '—';
                                    const hasPrecise = ticket.reported_lat != null && ticket.reported_lng != null;
                                    const preciseLat = hasPrecise ? Number(ticket.reported_lat) : null;
                                    const preciseLng = hasPrecise ? Number(ticket.reported_lng) : null;
                                    
                                    return (
                                        <Marker
                                            key={ticket.ticket_id || Math.random()}
                                            position={position}
                                            icon={icon}
                                            ref={(marker) => {
                                                try {
                                                    if (marker) {
                                                        // Access underlying Leaflet marker instance
                                                        // In react-leaflet v4, the Leaflet instance is available on the component
                                                        const leafletMarker = marker._leaflet_element || marker;
                                                        markerRefs.current[ticket.ticket_id] = leafletMarker;
                                                    }
                                                } catch (error) {
                                                    console.error('Error setting marker ref:', error);
                                                }
                                            }}
                                        >
                                            <Popup>
                                                <div className="map-popup">
                                                    <span className="popup-id">{ticket.ticket_id}</span>
                                                    <h4 className="popup-issue">{issueText}</h4>
                                                    <p className="popup-loc">📍 {locationText}</p>
                                                    <p className="popup-loc">
                                                        {hasPrecise && Number.isFinite(preciseLat) && Number.isFinite(preciseLng)
                                                            ? `🧭 ${preciseLat.toFixed(6)}, ${preciseLng.toFixed(6)}`
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
                                } catch (error) {
                                    console.error('Error rendering marker for ticket:', ticket.ticket_id, error);
                                    return null;
                                }
                            })}
                        </MarkerClusterGroup>
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default CoverageMap;
