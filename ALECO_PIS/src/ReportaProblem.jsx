import React, { useState, useCallback } from 'react';
import './CSS/ReportaProblem.css';
import { formatToPhilippineTime } from './utils/dateUtils';
import { ALECO_SCOPE } from '../alecoScope';
import { matchGPSToAlecoScope, validateDistrictMunicipality } from './utils/gpsLocationMatcher';

// Importing the Lego Bricks
import TextFieldProblem from './components/textfields/TextFieldProblem';
import ExplainTheProblem from './components/textfields/ExplainTheProblem';
import UploadTheProblem from './components/buckets/UploadTheProblem';
import TicketPopUp from './components/containers/TicketPopUp'; 
import IssueCategoryDropdown from './components/dropdowns/IssueCategoryDropdown';
import LocationPreviewMap from './components/LocationPreviewMap';

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
        isLocked: false,  // NEW: Prevents accidental override
        confidence: 'low' // NEW: Tracks confidence level
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

// ❌ REMOVED: handleLocationUpdate callback (no longer needed)

    // --- ENHANCED: Find My Location Handler ---
    const handleFindMyLocation = () => {
        console.log('🚀 [STEP 1] Find My Location button clicked');
        
        if (!navigator.geolocation) {
            console.error('❌ [STEP 1 FAILED] Browser does not support geolocation');
            setLocationError('Your browser does not support location services.');
            return;
        }

        console.log('✅ [STEP 1 PASSED] Geolocation API available');
        setIsLocating(true);
        setLocationError('');

        console.log('📡 [STEP 2] Requesting GPS coordinates...');
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                
                console.log('✅ [STEP 2 PASSED] GPS ACQUIRED:', { latitude, longitude, accuracy });

                try {
                    console.log('🌐 [STEP 3] Calling Google Geocoding API...');
                    console.log('   API Key exists:', !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
                    
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                    );
                    const data = await response.json();

                    console.log('📦 [STEP 3] Google API Response Status:', data.status);
                    console.log('📦 [STEP 3] Full Response:', data);

                    if (data.status === 'OK' && data.results.length > 0) {
                        console.log('✅ [STEP 3 PASSED] Google returned results');
                        
                        const result = data.results[0];
                        const components = result.address_components;

                        console.log('🔍 [STEP 4] Parsing address components...');
                        console.log('   Total components:', components.length);

                        // Extract location components
                        let street = '';
                        let barangay = '';
                        let googleMunicipality = '';
                        let province = '';

                        components.forEach((comp, index) => {
                            console.log(`   Component ${index}:`, comp.long_name, '→', comp.types);
                            
                            if (comp.types.includes('route')) street = comp.long_name;
                            
                            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) {
                                barangay = comp.long_name;
                            }
                            
                            // PRIORITY 1: locality (most reliable for municipality)
                            if (comp.types.includes('locality')) {
                                googleMunicipality = comp.long_name;
                            }
                            
                            // PRIORITY 2: administrative_area_level_2 (could be municipality OR province)
                            if (comp.types.includes('administrative_area_level_2')) {
                                if (!googleMunicipality) {
                                    googleMunicipality = comp.long_name;
                                }
                                province = comp.long_name;
                            }
                            
                            // FALLBACK: administrative_area_level_1
                            if (comp.types.includes('administrative_area_level_1') && !province) {
                                province = comp.long_name;
                            }
                        });

                        console.log('✅ [STEP 4 PASSED] Extracted Components:', { 
                            street, 
                            barangay, 
                            municipality: googleMunicipality, 
                            province,
                            fullAddress: result.formatted_address 
                        });

                        // --- CRITICAL FIX: Detect if municipality === province ---
                        let alecoMatch = null;

                        console.log('🔍 [STEP 5] Validating province...');

                        if (googleMunicipality.toLowerCase() === province.toLowerCase()) {
                            console.error('❌ [STEP 5 FAILED] Google returned province as municipality');
                            setLocationError(
                                `⚠️ Could not determine exact municipality.\n\n` +
                                `GPS detected: ${result.formatted_address}\n\n` +
                                `Please manually select your municipality below.`
                            );
                            setIsLocating(false);
                            return;
                        }

                        if (!province || !province.toLowerCase().includes('albay')) {
                            console.error('❌ [STEP 5 FAILED] Province validation failed:', province);
                            setLocationError('❌ Location is outside Albay Province. ALECO only serves Albay.');
                            setIsLocating(false);
                            return;
                        }
                        console.log('✅ [STEP 5 PASSED] Province is Albay');

                        console.log('🎯 [STEP 6] Matching municipality to ALECO scope...');
                        console.log('   Input Municipality:', googleMunicipality);
                        console.log('   Input Province:', province);
                        
                        // STEP 2: Match Google's municipality to ALECO scope
                        if (googleMunicipality) {
                            console.log('🔍 [STEP 6] Calling matchGPSToAlecoScope...');
                            alecoMatch = matchGPSToAlecoScope(googleMunicipality, province);
                            console.log('📊 [STEP 6] Match Result:', alecoMatch);
                            
                            if (alecoMatch) {
                                console.log('✅ [STEP 6 PASSED] GOOGLE CONFIRMED MUNICIPALITY:', alecoMatch);
                            } else {
                                console.error('❌ [STEP 6 FAILED] No match found in ALECO scope');
                                console.error('   Google gave us:', googleMunicipality);
                                console.error('   Available municipalities:', ALECO_SCOPE.flatMap(d => d.municipalities.map(m => m.name)));
                                
                                // Google gave us a municipality, but it's not in ALECO scope
                                setLocationError(
                                    `❌ Location detected: ${googleMunicipality}, ${province}\n\n` +
                                    `This municipality is not covered by ALECO. Please verify your location.`
                                );
                                setIsLocating(false);
                                return;
                            }
                        } else {
                            console.error('❌ [STEP 6 FAILED] Google could not determine municipality');
                            console.error('   Full address:', result.formatted_address);
                            
                            // Google couldn't determine municipality (rare case)
                            setLocationError(
                                `⚠️ Could not determine municipality from GPS.\n\n` +
                                `Detected: ${result.formatted_address}\n\n` +
                                `Please manually select your district and municipality below.`
                            );
                            setIsLocating(false);
                            return;
                        }

                        console.log('🔍 [STEP 7] Validating district-municipality relationship...');
                        // STEP 3: Validate district-municipality relationship
                        const isValid = validateDistrictMunicipality(alecoMatch.municipality, alecoMatch.district);
                        console.log('📊 [STEP 7] Validation Result:', isValid);
                        
                        if (!isValid) {
                            console.error('❌ [STEP 7 FAILED] District-Municipality mismatch!');
                            console.error('   Municipality:', alecoMatch.municipality);
                            console.error('   District:', alecoMatch.district);
                            setLocationError('System error: Invalid district-municipality mapping.');
                            setIsLocating(false);
                            return;
                        }
                        console.log('✅ [STEP 7 PASSED] District-Municipality relationship valid');

                        console.log('🏗️ [STEP 8] Building address string...');
                        // --- BUILD ADDRESS STRING ---
                        const addressParts = [street, barangay].filter(Boolean);
                        const fullAddress = addressParts.length > 0 
                            ? addressParts.join(', ') 
                            : `Near ${alecoMatch.municipality} City Center`;
                        
                        console.log('   Final Address:', fullAddress);

                        console.log('📝 [STEP 9] Auto-filling form data...');
                        // --- AUTO-FILL FORM ---
                        setFormData(prev => {
                            const newData = {
                                ...prev,
                                address: fullAddress,
                                district: alecoMatch.district,
                                municipality: alecoMatch.municipality
                            };
                            console.log('   New Form Data:', newData);
                            return newData;
                        });

                        console.log('🔒 [STEP 10] Locking GPS data...');
                        // --- LOCK GPS DATA ---
                        const gpsLockData = {
                            lat: latitude,
                            lng: longitude,
                            accuracy: Math.round(accuracy),
                            method: 'gps',
                            confidence: 'high',
                            isLocked: true
                        };
                        console.log('   GPS Lock Data:', gpsLockData);
                        setGpsData(gpsLockData);

                        setLocationError('');
                        setIsLocating(false);
                        
                        console.log('🎉 [SUCCESS] GPS LOCK COMPLETE:', {
                            municipality: alecoMatch.municipality,
                            district: alecoMatch.district,
                            accuracy: Math.round(accuracy),
                            address: fullAddress
                        });

                    } else {
                        console.error('❌ [STEP 3 FAILED] Google API returned no results');
                        console.error('   Status:', data.status);
                        console.error('   Error Message:', data.error_message);
                        setLocationError('Could not determine your address from GPS. Please enter manually.');
                        setIsLocating(false);
                    }
                } catch (error) {
                    console.error('❌ [STEP 3 EXCEPTION] Geocoding Error:', error);
                    console.error('   Error Name:', error.name);
                    console.error('   Error Message:', error.message);
                    console.error('   Stack:', error.stack);
                    setLocationError('Failed to process GPS location. Please try again or enter manually.');
                    setIsLocating(false);
                }
            },
            (error) => {
                console.error('❌ [STEP 2 FAILED] GPS Error:', error);
                console.error('   Error Code:', error.code);
                console.error('   Error Message:', error.message);
                console.error('   Error Details:', {
                    PERMISSION_DENIED: error.code === 1,
                    POSITION_UNAVAILABLE: error.code === 2,
                    TIMEOUT: error.code === 3
                });
                setLocationError('Unable to access your location. Please check your device settings.');
                setIsLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        
        console.log('⏳ [STEP 2] Waiting for GPS response...');
    };

    // --- NEW: Unlock GPS Lock (Allow Manual Override) ---
    const handleUnlockGPS = () => {
        setGpsData(prev => ({ ...prev, isLocked: false }));
    };

    // --- NEW: Clear GPS Data Completely ---
    const handleClearGPS = () => {
        setGpsData({ 
            lat: null, 
            lng: null, 
            accuracy: null, 
            method: 'manual', 
            isLocked: false 
        });
        setFormData(prev => ({ 
            ...prev, 
            address: '', 
            district: '', 
            municipality: '' 
        }));
        setLocationError('');
        console.log('🔓 GPS Lock Cleared - Manual entry enabled');
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

        // 2. DUPLICATE DETECTION CHECK
        try {
            console.log('🔍 Checking for duplicate tickets...');

            const duplicateCheckResponse = await fetch('http://localhost:5000/api/check-duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: formData.phoneNumber,
                    concern: formData.concern,
                    category: formData.category
                })
            });

            const duplicateResult = await duplicateCheckResponse.json();
            console.log('📊 Duplicate Check Result:', duplicateResult);

            if (duplicateResult.success && duplicateResult.hasDuplicates) {
                const duplicates = duplicateResult.duplicates;

                // Format duplicate information for user-friendly display
                const duplicateList = duplicates.map((d, index) =>
                    `\n${index + 1}. Ticket ID: ${d.ticket_id}\n` +
                    `   Status: ${d.status}\n` +
                    `   Similarity: ${d.similarityScore}% match\n` +
                    `   Concern: "${d.concern}"\n` +
                    `   Reported: ${new Date(d.created_at).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}`
                ).join('\n');

                const userConfirmation = window.confirm(
                    `⚠️ POTENTIAL DUPLICATE DETECTED!\n\n` +
                    `We found ${duplicates.length} similar ticket(s) from your number in the last 24 hours:\n` +
                    duplicateList +
                    `\n\n` +
                    `📌 Your existing ticket is already being processed.\n\n` +
                    `Do you still want to submit a NEW ticket?\n\n` +
                    `(Click "Cancel" to avoid duplicate submission)`
                );

                if (!userConfirmation) {
                    console.log('❌ User cancelled submission due to duplicate warning');
                    return; // Stop submission
                }

                console.log('✅ User confirmed submission despite duplicate warning');
            } else {
                console.log('✅ No duplicates found - proceeding with submission');
            }
        } catch (duplicateCheckError) {
            console.error('⚠️ Duplicate check failed:', duplicateCheckError);
            // Continue with submission even if duplicate check fails (failsafe)
            console.log('⚠️ Proceeding with submission despite duplicate check failure');
        }

        // 3. DATA PREPARATION
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

        // --- OPTIMIZED URGENT KEYWORD LIST ---
        const urgentKeywords = [
            // === TIER 1: IMMEDIATE DANGER (Life-Threatening) ===
            'sparking', 'fire', 'sunog', 'explosion', 'sumabog', 'pumuputok',
            'electrocuted', 'nakuryente', 'live wire', 'nakabitin na wire',
            'smoke', 'usok', 'umuusok', 'burning', 'nasusunog',
            
            // === TIER 2: STRUCTURAL HAZARDS (Property Damage Risk) ===
            'fallen pole', 'natumba', 'nahulog na poste', 'leaning pole', 'nakahilig',
            'dangling wire', 'nakabitin', 'naputol na wire', 'cutoff wire',
            
            // === TIER 3: POWER EMERGENCIES (Widespread Impact) ===
            'walang kuryente', 'patay na kuryente', 'brownout', 'blackout',
            'no power', 'power outage', 'emergency', 'aksidente'
        ];

        const lowerConcern = formData.concern.toLowerCase();

        // Word-boundary matching to prevent false positives
        const isUrgent = urgentKeywords.some(keyword => {
            const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
            const match = regex.test(lowerConcern);
            
            if (match) {
                console.log(`🚨 URGENT TRIGGER: "${keyword}" found in "${formData.concern}"`);
            }
            
            return match;
        });

        console.log(`🚨 Final Urgent Status: ${isUrgent ? 'YES' : 'NO'}`);

        submissionData.append('is_urgent', isUrgent ? 1 : 0);

        submissionData.append('category', formData.category);
        submissionData.append('concern', formData.concern);

        if (selectedFile) {
            submissionData.append('image', selectedFile);
        }

        // 4. BACKEND EXECUTION
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

                            {/* GPS Location Button */}
                            <div className="gps-location-section">
                                <button 
                                    type="button"
                                    onClick={handleFindMyLocation}
                                    className="btn-find-location"
                                    disabled={isLocating || gpsData.isLocked}
                                >
                                    {isLocating ? '📡 Locating...' : '📍 Find My Location'}
                                </button>
                                
                                {locationError && (
                                    <div className="location-error-box">
                                        ⚠️ {locationError}
                                    </div>
                                )}
                            </div>

                            {/* GPS Lock Confirmation */}
                            {gpsData.isLocked && (
                                <div className="location-success-box">
                                    <div className="gps-lock-info">
                                        <span className="gps-lock-icon">🔒</span>
                                        <div>
                                            <strong>Using device location</strong>
                                            <p className="gps-lock-details">
                                                📍 {formData.address}<br/>
                                                <strong>{formData.municipality}</strong>, {formData.district}
                                            </p>
                                            <p className="gps-accuracy">
                                                Accuracy: ±{gpsData.accuracy}m
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleClearGPS}
                                        className="location-clear-btn"
                                    >
                                        ✖ Clear & Re-locate
                                    </button>
                                </div>
                            )}

                            {/* Manual Address Field (Disabled when GPS is locked) */}
                            <TextFieldProblem 
                                id="address" 
                                label="Full Address *" 
                                value={formData.address} 
                                onChange={handleFieldChange('address')}
                                disabled={gpsData.isLocked}
                                placeholder={gpsData.isLocked ? "Auto-filled by GPS" : "Enter your address"}
                            />

                            {/* Hidden fields for district/municipality (GPS auto-fills these) */}
                            <input type="hidden" name="district" value={formData.district} />
                            <input type="hidden" name="municipality" value={formData.municipality} />

                            {/* --- LIVE GPS MAP PREVIEW --- */}
                            {gpsData.method === 'gps' && gpsData.lat && gpsData.lng && (
                                <LocationPreviewMap 
                                    latitude={gpsData.lat}
                                    longitude={gpsData.lng}
                                    accuracy={gpsData.accuracy}
                                    municipality={formData.municipality}
                                    district={formData.district}
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
