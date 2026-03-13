import React, { useState, useCallback } from 'react';
import './CSS/ReportaProblem.css';
import { formatToPhilippineTime } from './utils/dateUtils';

// Importing the Lego Bricks
import TextFieldProblem from './components/textfields/TextFieldProblem';
import ExplainTheProblem from './components/textfields/ExplainTheProblem';
import UploadTheProblem from './components/buckets/UploadTheProblem';
import TicketPopUp from './components/containers/TicketPopUp'; 
import IssueCategoryDropdown from './components/dropdowns/IssueCategoryDropdown';
import AlecoScopeDropdown from './components/dropdowns/AlecoScopeDropdown';
import LocationPreviewMap from './components/LocationPreviewMap'; // NEW IMPORT

const ReportaProblem = () => {
    // --- Phase State Management ---
    const [isFlipped, setIsFlipped] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [generatedId, setGeneratedId] = useState('');
    
    // --- Tracking & Status State ---
    const [trackingId, setTrackingId] = useState('');
    const [ticketData, setTicketData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- File/Image State ---
    const [selectedFile, setSelectedFile] = useState(null);

    // --- NEW: Enhanced GPS State ---
    const [gpsData, setGpsData] = useState({
        lat: null,
        lng: null,
        accuracy: null,
        method: 'manual', // 'manual' or 'gps'
        isLocked: false    // NEW: Prevents accidental override
    });
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState('');

    // --- Master State ---
    const [formData, setFormData] = useState({
        accountNumber: '',
        firstName: '',
        middleName: '',
        lastName: '',
        phoneNumber: '',
        address: '',
        category: '',
        concern: '',
        district: '',
        municipality: ''
    });

   const handleFieldChange = useCallback((field) => (value) => {
    setFormData(prev => {
        // Only update if the value actually changed to prevent unnecessary re-renders
        if (prev[field] === value) return prev; 
        return { ...prev, [field]: value };
    });
}, []);

const handleLocationUpdate = useCallback((locationObj) => {
    setFormData(prev => {
        // If data is null and already empty, bail out to prevent render
        if (!locationObj && !prev.district) return prev;

        // Semantic Equality Check (Content-based)
        const isSame = locationObj && 
            prev.district === locationObj.district &&
            prev.municipality === locationObj.municipality &&
            prev.barangay === locationObj.barangay &&
            prev.purok === locationObj.purok;

        if (isSame) return prev; // BAIL OUT: This snaps the infinite loop

        return { 
            ...prev, 
            district: locationObj?.district || '',
            municipality: locationObj?.municipality || '',
            barangay: locationObj?.barangay || '',
            purok: locationObj?.purok || ''
        };
    });
}, []);

    // --- ENHANCED: Find My Location Handler ---
    const handleFindMyLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Your browser does not support location services.');
            return;
        }

        setIsLocating(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                
                console.log('📍 GPS Acquired:', { latitude, longitude, accuracy });

                try {
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                    );
                    const data = await response.json();

                    if (data.status === 'OK' && data.results[0]) {
                        const result = data.results[0];
                        const components = result.address_components;
                        
                        // --- EXTRACT ALL ADDRESS COMPONENTS ---
                        let street = '';
                        let barangay = '';
                        let municipality = '';
                        let district = '';

                        components.forEach(comp => {
                            if (comp.types.includes('route')) {
                                street = comp.long_name;
                            }
                            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) {
                                barangay = comp.long_name;
                            }
                            if (comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')) {
                                municipality = comp.long_name;
                            }
                        });

                        // --- MATCH MUNICIPALITY TO ALECO DISTRICT ---
                        const ALECO_SCOPE = [
                            { district: "First District (North Albay)", municipalities: ["Bacacay", "Malilipot", "Malinao", "Santo Domingo", "Tabaco City", "Tiwi"] },
                            { district: "Second District (Central Albay)", municipalities: ["Camalig", "Daraga", "Legazpi City", "Manito", "Rapu-Rapu"] },
                            { district: "Third District (South Albay)", municipalities: ["Guinobatan", "Jovellar", "Libon", "Ligao City", "Oas", "Pio Duran", "Polangui"] }
                        ];

                        ALECO_SCOPE.forEach(districtObj => {
                            if (districtObj.municipalities.some(muni => 
                                municipality.toLowerCase().includes(muni.toLowerCase())
                            )) {
                                district = districtObj.district;
                            }
                        });

                        // --- BUILD SMART ADDRESS STRING ---
                        const addressParts = [street, barangay].filter(Boolean);
                        const fullAddress = addressParts.length > 0 
                            ? addressParts.join(', ') 
                            : `Near ${municipality} City Center`;

                        // --- AUTO-FILL FORM (GPS-LOCKED MODE) ---
                        setFormData(prev => ({
                            ...prev,
                            address: fullAddress,
                            district: district,
                            municipality: municipality
                        }));

                        // --- LOCK GPS DATA ---
                        setGpsData({
                            lat: latitude,
                            lng: longitude,
                            accuracy: Math.round(accuracy),
                            method: 'gps',
                            isLocked: true
                        });

                        console.log('✅ Auto-filled:', { fullAddress, municipality, district });
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    setLocationError('Could not determine your address. Please enter manually.');
                }

                setIsLocating(false);
            },
            (error) => {
                setIsLocating(false);
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError('Location access denied. Please enable location services.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError('Location information unavailable.');
                        break;
                    case error.TIMEOUT:
                        setLocationError('Location request timed out.');
                        break;
                    default:
                        setLocationError('An unknown error occurred.');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    // --- NEW: Unlock GPS Lock (Allow Manual Override) ---
    const handleUnlockGPS = () => {
        setGpsData(prev => ({ ...prev, isLocked: false }));
    };

    // --- NEW: Clear GPS Data Completely ---
    const handleClearGPS = () => {
        setGpsData({ lat: null, lng: null, accuracy: null, method: 'manual', isLocked: false });
        setFormData(prev => ({ ...prev, address: '', district: '', municipality: '' }));
    };

    // --- Backend: Submit Ticket ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. STRICT VALIDATION (Updated for GPS compatibility)
        const mandatoryFields = [
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'phoneNumber', label: 'Phone Number' },
            { key: 'address', label: 'Street Address' },
            { key: 'municipality', label: 'Municipality/City' },
            { key: 'category', label: 'Issue Category' },
            { key: 'concern', label: 'Issue Details' }
        ];

        for (const field of mandatoryFields) {
            if (!formData[field.key] || formData[field.key].trim() === '') {
                alert(`Please fill in: ${field.label}`);
                return;
            }
        }

        // 2. DATA PREPARATION
        const submissionData = new FormData();
        
        // Personal Info
        submissionData.append('account_number', formData.accountNumber || "");
        submissionData.append('first_name', formData.firstName);
        submissionData.append('middle_name', formData.middleName || "");
        submissionData.append('last_name', formData.lastName);
        submissionData.append('phone_number', formData.phoneNumber);
        submissionData.append('address', formData.address);

        // Location Data (District/Municipality for display)
        submissionData.append('district', formData.district || "");
        submissionData.append('municipality', formData.municipality || "");

        // --- NEW: GPS COORDINATES ---
        submissionData.append('reported_lat', gpsData.lat || null);
        submissionData.append('reported_lng', gpsData.lng || null);
        submissionData.append('location_accuracy', gpsData.accuracy || null);
        submissionData.append('location_method', gpsData.method);

        // Urgent Keyword Scanner
        const urgentKeywords = ['sparking', 'sunog', 'fire', 'live wire', 'pumuputok', 
            'matutumba', 'kuryente', 'emergency', 'sumabog', 
            'grounded', 'nakuryente', 'usok', 'umuusok', 'aksidente', 'natumba', 'urgent'];
        const lowerConcern = formData.concern.toLowerCase();
        const isUrgent = urgentKeywords.some(keyword => lowerConcern.includes(keyword));
        submissionData.append('is_urgent', isUrgent ? 1 : 0);

        submissionData.append('category', formData.category);
        submissionData.append('concern', formData.concern);

        if (selectedFile) {
            submissionData.append('image', selectedFile); 
        }

        // 3. BACKEND EXECUTION
        try {
            const response = await fetch('http://localhost:5000/api/tickets/submit', {
                method: 'POST',
                body: submissionData, 
            });
            
            const data = await response.json();
            
            if (data.success) {
                setGeneratedId(data.ticketId);
                setShowModal(true); 
            
                // RESET FORM
                setFormData({ 
                    accountNumber: '', firstName: '', middleName: '', 
                    lastName: '', phoneNumber: '', address: '', 
                    category: '', concern: '', district: '', 
                    municipality: ''
                });
                setSelectedFile(null);
                setGpsData({ lat: null, lng: null, accuracy: null, method: 'manual' }); // Reset GPS
            } else {
                alert("Submission failed: " + data.message);
            }
        } catch (error) {
            console.error("Submission Error:", error);
            alert("Connection error. Is the server running?");
        }
    };
    // --- Backend: Track Ticket Status ---
    const handleTrackTicket = async () => {
        if (!trackingId) return alert("Please enter a Ticket ID.");
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:5000/api/tickets/track/${trackingId}`);
            const result = await response.json();
            if (result.success) {
                setTicketData(result.data);
            } else {
                alert(result.message);
                setTicketData(null);
            }
        } catch (error) {
            console.error("Tracking Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Backend: Email Logic (Triggered from PopUp) ---
    const handleSendEmailCopy = async (email, setSentStatus) => {
        try {
            const response = await fetch('http://localhost:5000/api/tickets/send-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, ticketId: generatedId })
            });
            if (response.ok) setSentStatus(true);
        } catch (err) { 
            console.error(err); 
            alert("Could not send email.");
        }
    };

    return (
        <div id="report" className="report-problem-container">
            <div className={`report-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
                
                {/* --- FRONT SIDE: REPORT FORM --- */}
                <div className="report-card-front">
                    <div className="report-header-section">
                        <h2 className="report-title">Report a Problem</h2>
                        <p className="report-description">Brownouts, damaged posts, broken wires, etc.</p>
                        <div style={{ marginTop: '15px', display: 'flex' }}>
                            <button type="button" className="flip-button-style" onClick={() => setIsFlipped(true)}>
                                Track Your Ticket 
                                <svg className="flip-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        </div>
                    </div>

                    <form className="report-main-card" onSubmit={handleSubmit}>
                        <div className="report-form-column">
                            <h3 className="column-section-title">Contact Information</h3>
                            <TextFieldProblem id="acc_num" label="Account Number (Optional)" value={formData.accountNumber} onChange={handleFieldChange('accountNumber')} filterType="numeric" maxLength={15} />
                            <TextFieldProblem id="fname" label="First Name *" value={formData.firstName} onChange={handleFieldChange('firstName')} filterType="name" />
                            <TextFieldProblem id="mname" label="Middle Name" value={formData.middleName} onChange={handleFieldChange('middleName')} filterType="name" />
                            <TextFieldProblem id="lname" label="Last Name *" value={formData.lastName} onChange={handleFieldChange('lastName')} filterType="name" />
                            <TextFieldProblem id="phone" label="Phone Number *" value={formData.phoneNumber} onChange={handleFieldChange('phoneNumber')} filterType="numeric" maxLength={11} />
                            
                            <h3 className="column-section-title" style={{ marginTop: '30px' }}>Location Details</h3>

                            {/* --- FULL ADDRESS FIELD (Auto-filled by GPS or Manual) --- */}
                            <TextFieldProblem 
                                id="address" 
                                label="Full Address *" 
                                value={formData.address} 
                                onChange={handleFieldChange('address')}
                                disabled={gpsData.isLocked} // Locked when GPS is active
                            />

                            {/* --- DISTRICT/MUNICIPALITY DROPDOWN --- */}
                            <h3 className="column-section-title" style={{ marginTop: '30px' }}>
                                Specific Area (District/Municipality)
                            </h3>
                            <div className="dropdown-location-wrapper">
                                <AlecoScopeDropdown  
                                    onLocationSelect={handleLocationUpdate}
                                    disabled={gpsData.isLocked} // Locked when GPS is active
                                />
                            </div>

                            {/* --- FIND MY LOCATION BUTTON --- */}
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button 
                                    type="button"
                                    onClick={handleFindMyLocation}
                                    disabled={isLocating || gpsData.isLocked}
                                    className="find-location-btn"
                                >
                                    {isLocating ? (
                                        <>
                                            <span className="spinner"></span>
                                            Locating...
                                        </>
                                    ) : gpsData.isLocked ? (
                                        <>
                                            ✅ Location Locked (±{gpsData.accuracy}m accuracy)
                                        </>
                                    ) : (
                                        <>
                                            📍 Find My Location
                                        </>
                                    )}
                                </button>

                                {/* Error Box */}
                                {locationError && (
                                    <div className="location-error-box">
                                        {locationError}
                                    </div>
                                )}

                                {/* GPS Lock Confirmation with Override Option */}
                                {gpsData.isLocked && (
                                    <div className="location-success-box">
                                        <div className="gps-lock-info">
                                            <span className="gps-lock-icon">�</span>
                                            <div>
                                                <strong>Using device location</strong>
                                                <p className="gps-lock-details">
                                                    {formData.address}<br/>
                                                    {formData.municipality}, {formData.district}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="gps-lock-actions">
                                            <button 
                                                type="button"
                                                onClick={handleUnlockGPS}
                                                className="location-unlock-btn"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={handleClearGPS}
                                                className="location-clear-btn"
                                            >
                                                ✖ Clear
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- LIVE GPS MAP PREVIEW --- */}
                            {gpsData.method === 'gps' && gpsData.lat && gpsData.lng && (
                                <LocationPreviewMap 
                                    latitude={gpsData.lat}
                                    longitude={gpsData.lng}
                                    accuracy={gpsData.accuracy}
                                    municipality={formData.municipality}
                                />
                            )}
                        </div>
                        
                        <div className="report-details-column">
                            <h3 className="column-section-title">Issue Category</h3>
                             {/* Issue Category Dropdown Lego Brick */}
                                    <IssueCategoryDropdown 
                                      value={formData.category} 
                                         onChange={handleFieldChange('category')} 
                                                                                />
                            <h3 className="column-section-title">Issue Details</h3>
                            <ExplainTheProblem value={formData.concern} onChange={handleFieldChange('concern')} />
                            <div className="upload-wrapper">
                                <UploadTheProblem onFileSelect={setSelectedFile} />
                            </div>
                            <div className="form-submit-row">
                                <button type="submit" className="btn-submit-report">Submit Report</button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* --- BACK SIDE: TRACKING UI --- */}
                <div className="report-card-back">
                    <div className="report-header-section">
                        <h2 className="report-title">Track Your Ticket</h2>
                        <p className="report-description">See the real-time status of your concern.</p>
                        <div style={{ marginTop: '15px', display: 'flex' }}>
                            <button type="button" className="flip-button-style" onClick={() => setIsFlipped(false)}>
                                <svg className="flip-icon" style={{ transform: 'rotate(180deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                Back to Report
                            </button>
                        </div>
                    </div>

                    <div className="report-main-card tracking-card-content">
                        <div className="track-input-container">
                            <TextFieldProblem id="track_id" label="Tracking Number" placeholder="e.g. ALECO-X892J" value={trackingId} onChange={setTrackingId} />
                            <button className="btn-track-submit" onClick={handleTrackTicket} disabled={isLoading}>
                                {isLoading ? "Searching..." : "Check Status"}
                            </button>
                        </div>

                        {ticketData && (
    <div className="status-results-container">
    <div className="status-stepper">
        <div className="line"></div>
        {/* STEP 1 */}
        <div className={`step active`}>
            <div className="circle yellow-glow active">1</div>
            <span>Pending</span>
        </div>
        
        {/* STEP 2 */}
        <div className={`step ${['Ongoing', 'Restored'].includes(ticketData.status) ? 'active' : ''}`}>
            <div className={`circle blue-glow ${['Ongoing', 'Restored'].includes(ticketData.status) ? 'active' : ''}`}>2</div>
            <span>Ongoing</span>
        </div>
        
        {/* STEP 3 */}
        <div className={`step ${ticketData.status === 'Restored' ? 'active' : ''}`}>
            <div className={`circle green-glow ${ticketData.status === 'Restored' ? 'active' : ''}`}>3</div>
            <span>Restored</span>
        </div>
    </div>

    <div className="status-details-card">
        <p>
            <strong>Current Status:</strong> 
            <span className={`status-tag ${ticketData.status.toLowerCase()}`}>{ticketData.status}</span>
        </p>
        
        {/* NEW: Displays the full name cleanly, ignoring the middle name if it is blank */}
        <p>
    <strong>Reported By:</strong> {
        [ticketData.first_name, ticketData.middle_name, ticketData.last_name]
        .filter(Boolean) // This automatically removes any NULL or blank middle names
        .join(' ') || "Name not provided" // Fallback if all 3 are NULL
    }
</p>
        
        <p>
            <strong>Date Reported:</strong> {formatToPhilippineTime(ticketData.created_at)}
        </p>
        
        <div className="concern-preview">
            <label>Your Concern:</label>
            <p>{ticketData.concern}</p>
        </div>
    </div>
</div>
                        )}
                    </div>
                </div>
            </div>
            
            {showModal && (
                <TicketPopUp 
                    ticketId={generatedId} 
                    onClose={() => setShowModal(false)} 
                    onSendEmail={handleSendEmailCopy} 
                />
            )}
            <div style={{ paddingBottom: '100px' }}></div>
        </div>
    );
};

export default ReportaProblem;
