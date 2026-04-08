import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import './CSS/ReportaProblem.css';
import { apiUrl } from './utils/api';
import { formatPhoneDisplay, INVALID_PHONE_HINT } from './utils/phoneUtils';
import { formatToPhilippineTime, formatToPhilippineTimeShort } from './utils/dateUtils';
import { formatTicketStatusLabel } from './utils/ticketStatusDisplay';
import { ALECO_SCOPE } from '../alecoScope';
import { matchGPSToAlecoScope, validateDistrictMunicipality } from './utils/gpsLocationMatcher';

// Importing the Lego Bricks
import TextFieldProblem from './components/textfields/TextFieldProblem';
import PhoneInputProblem from './components/textfields/PhoneInputProblem';
import ExplainTheProblem from './components/textfields/ExplainTheProblem';
import UploadTheProblem from './components/buckets/UploadTheProblem';
/* Portals (TicketPopUp, ConfirmModal) render under document.body — not inside #report; they do not inherit --report-scale unless styled separately */
import TicketPopUp from './components/containers/TicketPopUp'; 
import IssueCategoryDropdown from './components/dropdowns/IssueCategoryDropdown';
import LocationPreviewMap from './components/LocationPreviewMap';
import MapPinPicker from './components/maps/MapPinPicker';
import AlecoScopeDropdown from './components/dropdowns/AlecoScopeDropdown';
import ConfirmModal from './components/tickets/ConfirmModal';
import HotlinesDisplay from './components/contact/HotlinesDisplay';
import { DEFAULT_URGENT_KEYWORDS } from './constants/urgentKeywordsDefaults';
import { concernMatchesUrgentKeywords } from './utils/urgentKeywordMatch';
import './CSS/ReportaProblemViewportFix.css';

const TOTAL_STEPS = 6;

const ReportaProblem = () => {
    // --- Wizard State ---
    const [currentStep, setCurrentStep] = useState(1);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [pendingDuplicateData, setPendingDuplicateData] = useState(null);

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
    const [showMapPicker, setShowMapPicker] = useState(false);
    /** null = not loaded yet (use defaults); array = loaded (may be empty if admin cleared) */
    const [urgentKeywordsList, setUrgentKeywordsList] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(apiUrl('/api/urgent-keywords'));
                const data = await res.json();
                if (cancelled || !res.ok || !data?.success || !Array.isArray(data.keywords)) {
                    return;
                }
                setUrgentKeywordsList(data.keywords);
            } catch {
                /* leave null → submit uses DEFAULT_URGENT_KEYWORDS */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);


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

    useEffect(() => {
        const container = document.getElementById('report');
        if (!container) return;

        const computeScale = (w) => {
            if (w <= 320) return 0.55;
            if (w <= 374) return 0.65;
            if (w <= 424) return 0.68;
            if (w <= 767) return 0.72;
            if (w <= 1023) return 0.88;
            return 1;
        };

        const applyScale = () => {
            const width = window.visualViewport?.width ?? window.innerWidth;
            const scale = computeScale(width);
            container.style.setProperty('--report-scale', String(scale));
        };

        applyScale();

        const onResize = () => applyScale();
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onResize, { passive: true });
        window.visualViewport?.addEventListener?.('resize', onResize, { passive: true });
        window.visualViewport?.addEventListener?.('scroll', onResize, { passive: true });

        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            window.visualViewport?.removeEventListener?.('resize', onResize);
            window.visualViewport?.removeEventListener?.('scroll', onResize);
        };
    }, []);

   const handleFieldChange = useCallback((field) => (value) => {
    setFormData(prev => {
        // Only update if the value actually changed to prevent unnecessary re-renders
        if (prev[field] === value) return prev; 
        return { ...prev, [field]: value };
    });
}, []);

    const canProceed = useCallback((step) => {
        switch (step) {
            case 1: return !!formData.category;
            case 2: return !!formData.concern?.trim();
            case 3: return true;
            case 4: return !!formData.firstName?.trim() && !!formData.lastName?.trim() && !!formData.phoneNumber?.trim();
            case 5: return !!formData.address?.trim() && !!formData.municipality;
            case 6: return !!formData.category && !!formData.concern?.trim() && !!formData.firstName?.trim() && !!formData.lastName?.trim() && !!formData.phoneNumber?.trim() && !!formData.address?.trim() && !!formData.municipality;
            default: return false;
        }
    }, [formData]);

    const getStepState = (step) => {
        if (step < currentStep) return 'done';
        if (step === currentStep) return 'active';
        return 'pending';
    };

    // --- ENHANCED: Find My Location Handler ---
    const handleFindMyLocation = () => {
        if (!navigator.geolocation) {
            console.error('❌ [STEP 1 FAILED] Browser does not support geolocation');
            setLocationError('Your browser does not support location services.');
            return;
        }

        setIsLocating(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;

                try {
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                    );
                    const data = await response.json();

                    if (data.status === 'OK' && data.results.length > 0) {
                        const result = data.results[0];
                        const components = result.address_components;

                        // Extract location components
                        let street = '';
                        let barangay = '';
                        let googleMunicipality = '';
                        let province = '';

                        components.forEach((comp) => {
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

                        // --- CRITICAL FIX: Detect if municipality === province ---
                        let alecoMatch = null;

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

                        // STEP 2: Match Google's municipality to ALECO scope
                        if (googleMunicipality) {
                            alecoMatch = matchGPSToAlecoScope(googleMunicipality, province);
                            
                            if (alecoMatch) {
                                // Match found, continue
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

                        // STEP 3: Validate district-municipality relationship
                        const isValid = validateDistrictMunicipality(alecoMatch.municipality, alecoMatch.district);
                        
                        if (!isValid) {
                            console.error('❌ [STEP 7 FAILED] District-Municipality mismatch!');
                            console.error('   Municipality:', alecoMatch.municipality);
                            console.error('   District:', alecoMatch.district);
                            setLocationError('System error: Invalid district-municipality mapping.');
                            setIsLocating(false);
                            return;
                        }

                        // --- BUILD ADDRESS STRING ---
                        const addressParts = [street, barangay].filter(Boolean);
                        const fullAddress = addressParts.length > 0 
                            ? addressParts.join(', ') 
                            : `Near ${alecoMatch.municipality} City Center`;

                        // --- AUTO-FILL FORM ---
                        setFormData(prev => {
                            const newData = {
                                ...prev,
                                address: fullAddress,
                                district: alecoMatch.district,
                                municipality: alecoMatch.municipality
                            };
                            return newData;
                        });

                        // --- LOCK GPS DATA ---
                        const gpsLockData = {
                            lat: latitude,
                            lng: longitude,
                            accuracy: Math.round(accuracy),
                            method: 'gps',
                            confidence: 'high',
                            isLocked: true
                        };
                        setGpsData(gpsLockData);

                        setLocationError('');
                        setIsLocating(false);

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
    };

    // --- NEW: Unlock GPS Lock (Allow Manual Override) ---
    const handleUnlockGPS = () => {
        setGpsData(prev => ({ ...prev, isLocked: false }));
    };

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
    };

    const executeSubmit = async () => {
        // 1. DATA PREPARATION
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
        submissionData.append('location_confidence', gpsData.confidence || 'medium');

        const kws =
            urgentKeywordsList === null ? DEFAULT_URGENT_KEYWORDS : urgentKeywordsList;
        const isUrgent = concernMatchesUrgentKeywords(formData.concern, kws);

        submissionData.append('is_urgent', isUrgent ? 1 : 0);

        submissionData.append('category', formData.category);
        submissionData.append('concern', formData.concern);

        if (selectedFile) {
            submissionData.append('image', selectedFile);
        }

        // 4. BACKEND EXECUTION
        try {
            const response = await fetch(apiUrl('/api/tickets/submit'), {
                method: 'POST',
                body: submissionData,
            });
            
            const data = await response.json();
            
            if (data.success) {
                setGeneratedId(data.ticketId);
                setShowModal(true);
                setCurrentStep(1);

                // RESET FORM
                setFormData({
                    accountNumber: '', firstName: '', middleName: '',
                    lastName: '', phoneNumber: '', address: '',
                    category: '', concern: '', district: '',
                    municipality: ''
                });
                setSelectedFile(null);
                setGpsData({ lat: null, lng: null, accuracy: null, method: 'manual', isLocked: false, confidence: 'low' });
            } else {
                toast.error("Submission failed: " + data.message);
            }
        } catch (error) {
            console.error("Submission Error:", error);
            toast.error("Connection error. Is the server running?");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Only submit when on the Review step (6); prevent accidental submit from Enter key on earlier steps
        if (currentStep !== TOTAL_STEPS) {
            return;
        }

        // 1. STRICT VALIDATION
        const mandatoryFields = [
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'phoneNumber', label: 'Phone Number' },
            { key: 'address', label: 'Street Address' },
            { key: 'district', label: 'District' },
            { key: 'municipality', label: 'Municipality/City' },
            { key: 'category', label: 'Issue Category' },
            { key: 'concern', label: 'Issue Details' }
        ];

        for (const field of mandatoryFields) {
            if (!formData[field.key] || String(formData[field.key]).trim() === '') {
                toast.warning(`Please fill in: ${field.label}`);
                return;
            }
        }

        // 2. DUPLICATE DETECTION CHECK
        try {
            const duplicateCheckResponse = await fetch(apiUrl('/api/check-duplicates'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: formData.phoneNumber,
                    concern: formData.concern,
                    category: formData.category
                })
            });

            const duplicateResult = await duplicateCheckResponse.json();

            if (!duplicateCheckResponse.ok) {
                toast.error(duplicateResult.message || INVALID_PHONE_HINT);
                return;
            }

            if (duplicateResult.success && duplicateResult.hasDuplicates) {
                const duplicates = duplicateResult.duplicates;
                const duplicateList = duplicates.map((d, index) =>
                    `${index + 1}. Ticket ID: ${d.ticket_id} (${d.status}, ${d.similarityScore}% match) - ${formatToPhilippineTimeShort(d.created_at)}`
                ).join('\n');

                setPendingDuplicateData({ duplicates, duplicateList });
                setShowDuplicateModal(true);
                return;
            }
        } catch (duplicateCheckError) {
            console.error('⚠️ Duplicate check failed:', duplicateCheckError);
        }

        await executeSubmit();
    };

    const handleDuplicateConfirm = async () => {
        setShowDuplicateModal(false);
        const data = pendingDuplicateData;
        setPendingDuplicateData(null);
        if (data) await executeSubmit();
    };

    const handleDuplicateCancel = () => {
        setShowDuplicateModal(false);
        setPendingDuplicateData(null);
        toast.info('Submission cancelled.');
    };
    // --- Backend: Track Ticket Status ---
    const handleTrackTicket = async () => {
        if (!trackingId?.trim()) {
            toast.warning("Please enter a Ticket ID.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(apiUrl(`/api/tickets/track/${trackingId}`));
            const result = await response.json();
            if (result.success) {
                setTicketData(result.data);
            } else {
                toast.error(result.message);
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
            const response = await fetch(apiUrl('/api/tickets/send-copy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, ticketId: generatedId })
            });
            if (response.ok) setSentStatus(true);
        } catch (err) { 
            console.error(err); 
            toast.error("Could not send email.");
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

                    <div className="report-main-card report-wizard-form" role="form" aria-label="Report a Problem" onKeyDown={(e) => { if (e.key === 'Enter' && currentStep < TOTAL_STEPS && canProceed(currentStep)) { e.preventDefault(); setCurrentStep(s => s + 1); } }}>
                        {/* Dispatch-style Stepper */}
                        <div className="report-wizard-stepper">
                            {[
                                { num: 1, label: 'Category' },
                                { num: 2, label: 'Explain' },
                                { num: 3, label: 'Upload' },
                                { num: 4, label: 'Contact' },
                                { num: 5, label: 'Location' },
                                { num: 6, label: 'Submit' }
                            ].map((s, i) => (
                                <React.Fragment key={s.num}>
                                    <div
                                        className={`stepper-step ${getStepState(s.num)} ${currentStep >= s.num ? 'clickable' : ''}`}
                                        onClick={() => currentStep >= s.num && setCurrentStep(s.num)}
                                        role="button"
                                        tabIndex={currentStep >= s.num ? 0 : -1}
                                        onKeyDown={(e) => currentStep >= s.num && (e.key === 'Enter' || e.key === ' ') && setCurrentStep(s.num)}
                                    >
                                        <span className="stepper-num">{s.num}</span>
                                        <span className="stepper-label-short">{s.label}</span>
                                    </div>
                                    {i < 5 && (
                                        <div
                                            className={`stepper-connector stepper-connector-${currentStep > s.num ? 'done' : currentStep === s.num ? 'active' : 'pending'}`}
                                            aria-hidden
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Step Content + Actions (row layout body) */}
                        <div className="wizard-body">
                        <div className="wizard-step-content">
                            {currentStep === 1 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Issue Category</h3>
                                    <IssueCategoryDropdown value={formData.category} onChange={handleFieldChange('category')} />
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Explain the Problem</h3>
                                    <ExplainTheProblem value={formData.concern} onChange={handleFieldChange('concern')} />
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Upload Picture (Optional)</h3>
                                    <div className="upload-wrapper">
                                        <UploadTheProblem onFileSelect={setSelectedFile} />
                                    </div>
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Contact Information</h3>
                                    <HotlinesDisplay />
                                    <TextFieldProblem id="acc_num" label="Account Number (Optional)" value={formData.accountNumber} onChange={handleFieldChange('accountNumber')} filterType="numeric" maxLength={15} />
                                    <TextFieldProblem id="fname" label="First Name *" value={formData.firstName} onChange={handleFieldChange('firstName')} filterType="name" />
                                    <TextFieldProblem id="mname" label="Middle Name" value={formData.middleName} onChange={handleFieldChange('middleName')} filterType="name" />
                                    <TextFieldProblem id="lname" label="Last Name *" value={formData.lastName} onChange={handleFieldChange('lastName')} filterType="name" />
                                    <PhoneInputProblem id="phone" label="Phone Number *" value={formData.phoneNumber} onChange={handleFieldChange('phoneNumber')} />
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Find Location</h3>
                                    <div className="gps-location-section">
                                        <div className="gps-location-actions">
                                            <button
                                                type="button"
                                                onClick={handleFindMyLocation}
                                                className="btn-find-location"
                                                disabled={isLocating || gpsData.isLocked}
                                            >
                                                {isLocating ? '📡 Locating...' : '📍 Find My Location'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const muni = (formData.municipality || '').trim();
                                                    if (!muni) {
                                                        toast.info('Select a municipality first, then pin the exact spot on the map.');
                                                        return;
                                                    }
                                                    setShowMapPicker(true);
                                                }}
                                                className="btn-pin-location"
                                                disabled={isLocating || gpsData.isLocked}
                                            >
                                                🗺️ Pin Location on Map
                                            </button>
                                        </div>
                                        {locationError && (
                                            <div className="location-error-box">⚠️ {locationError}</div>
                                        )}
                                    </div>
                                    {gpsData.isLocked && (
                                        <div className="location-success-box">
                                            <div className="gps-lock-info">
                                                <span className="gps-lock-icon">🔒</span>
                                                <div>
                                                    <strong>
                                                        {gpsData.method === 'gps'
                                                            ? 'Using device location'
                                                            : gpsData.method === 'map_pin'
                                                                ? 'Using pinned location'
                                                                : 'Using selected location'}
                                                    </strong>
                                                    <p className="gps-lock-details">
                                                        📍 {formData.address}<br />
                                                        <strong>{formData.municipality}</strong>, {formData.district}
                                                    </p>
                                                    {gpsData.accuracy != null && (
                                                        <p className="gps-accuracy">Accuracy: ±{gpsData.accuracy}m</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleClearGPS} className="location-clear-btn">✖ Clear & Re-locate</button>
                                        </div>
                                    )}
                                    <TextFieldProblem
                                        id="address"
                                        label="Full Address *"
                                        value={formData.address}
                                        onChange={handleFieldChange('address')}
                                        placeholder={gpsData.isLocked ? "Auto-filled by GPS" : "Enter your address"}
                                    />
                                    {(!gpsData.isLocked || locationError) && (
                                        <div className="aleco-scope-manual">
                                            <label className="column-section-title">Or select manually</label>
                                            <AlecoScopeDropdown
                                                initialDistrict={formData.district}
                                                initialMunicipality={formData.municipality}
                                                onLocationSelect={(loc) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        district: loc?.district || '',
                                                        municipality: loc?.municipality || ''
                                                    }));
                                                }}
                                            />
                                        </div>
                                    )}
                                    {(gpsData.method === 'gps' || gpsData.method === 'map_pin') && gpsData.lat && gpsData.lng && (
                                        <LocationPreviewMap
                                            latitude={gpsData.lat}
                                            longitude={gpsData.lng}
                                            accuracy={gpsData.accuracy}
                                            municipality={formData.municipality}
                                            district={formData.district}
                                        />
                                    )}
                                    {showMapPicker && (() => {
                                        const muniName = (formData.municipality || '').trim().toLowerCase();
                                        const districtName = (formData.district || '').trim().toLowerCase();
                                        let initialLat = 13.1353;
                                        let initialLng = 123.7443;

                                        for (const d of ALECO_SCOPE) {
                                            const dName = String(d.district || '').toLowerCase();
                                            if (districtName && dName !== districtName) continue;
                                            for (const m of d.municipalities || []) {
                                                const name = String(m.name || '').toLowerCase();
                                                const googleName = String(m.googleName || '').toLowerCase();
                                                const clean = name.replace(' city', '').trim();
                                                const cleanGoogle = googleName.replace(' city', '').trim();
                                                const muniClean = muniName.replace(' city', '').trim();
                                                if (muniClean && (clean === muniClean || cleanGoogle === muniClean || name === muniName || googleName === muniName)) {
                                                    if (m.lat && m.lng) {
                                                        initialLat = m.lat;
                                                        initialLng = m.lng;
                                                    }
                                                    break;
                                                }
                                            }
                                        }

                                        return (
                                            <MapPinPicker
                                                initialLat={initialLat}
                                                initialLng={initialLng}
                                                onCancel={() => setShowMapPicker(false)}
                                                onConfirm={(lat, lng) => {
                                                    setGpsData({
                                                        lat,
                                                        lng,
                                                        accuracy: 5,
                                                        method: 'map_pin',
                                                        isLocked: true,
                                                        confidence: 'high'
                                                    });
                                                    setLocationError('');
                                                    setShowMapPicker(false);
                                                }}
                                            />
                                        );
                                    })()}
                                </div>
                            )}

                            {currentStep === 6 && (
                                <div className="wizard-step-block wizard-summary">
                                    <h3 className="column-section-title">Review and Submit</h3>
                                    <div className="summary-grid">
                                        <div className="summary-item"><strong>Category:</strong> {formData.category}</div>
                                        <div className="summary-item"><strong>Concern:</strong> {formData.concern}</div>
                                        <div className="summary-item"><strong>Name:</strong> {[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ')}</div>
                                        <div className="summary-item"><strong>Phone:</strong> {formatPhoneDisplay(formData.phoneNumber) || formData.phoneNumber}</div>
                                        <div className="summary-item"><strong>Address:</strong> {formData.address}</div>
                                        <div className="summary-item"><strong>Location:</strong> {formData.municipality}, {formData.district}</div>
                                        {selectedFile && <div className="summary-item"><strong>Photo:</strong> {selectedFile.name}</div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="wizard-actions">
                            {currentStep > 1 && (
                                <button type="button" className="btn-wizard-back" onClick={() => setCurrentStep(s => s - 1)}>
                                    ← Back
                                </button>
                            )}
                            <div className="wizard-actions-right">
                                {currentStep < TOTAL_STEPS ? (
                                    <button
                                        type="button"
                                        className="btn-wizard-next"
                                        disabled={!canProceed(currentStep)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canProceed(currentStep)) setCurrentStep(s => s + 1);
                                        }}
                                    >
                                        Next →
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn-submit-report"
                                        disabled={!canProceed(6)}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSubmit(e);
                                        }}
                                    >
                                        Submit Report
                                    </button>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>
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
                            <button type="button" className="btn-track-submit" onClick={handleTrackTicket} disabled={isLoading}>
                                {isLoading ? "Searching..." : "Check Status"}
                            </button>
                        </div>

                        {ticketData && (
    <div className="status-results-container">
    <div className="status-stepper">
        <div className="line"></div>
        {/* STEP 1: Pending */}
        <div className="step active">
            <div className="circle yellow-glow active">1</div>
            <span>Pending</span>
        </div>
        
        {/* STEP 2: Ongoing, On Hold, or Unresolved */}
        <div className={`step ${['Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>
            <div className={`circle ${ticketData.status === 'Unresolved' ? 'red-glow' : 'blue-glow'} ${['Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>2</div>
            <span>{ticketData.status === 'Unresolved' ? 'Unresolved' : ticketData.status === 'OnHold' ? 'On Hold' : 'Ongoing'}</span>
        </div>
        
        {/* STEP 3: Closed (Restored, NoFaultFound, AccessDenied) */}
        <div className={`step ${['Restored', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>
            <div className={`circle green-glow ${['Restored', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>3</div>
            <span>Closed</span>
        </div>
    </div>

    <div className="status-details-card">
        <p>
            <strong>Current Status:</strong> 
            <span className={`status-tag ${(ticketData.status || '').toLowerCase()}`}>{formatTicketStatusLabel(ticketData.status)}</span>
        </p>
        
        {['Ongoing', 'OnHold'].includes(ticketData.status) && (ticketData.assigned_crew || ticketData.eta || ticketData.hold_reason) && (
            <div className="crew-eta-info">
                {ticketData.assigned_crew && <p><strong>Crew dispatched:</strong> {ticketData.assigned_crew}</p>}
                {ticketData.eta && <p><strong>ETA:</strong> {ticketData.eta}</p>}
                {ticketData.hold_reason && (
                    <p className="hold-info"><strong>On Hold:</strong> {ticketData.hold_reason}. We will update you when work resumes.</p>
                )}
            </div>
        )}
        
        {ticketData.status === 'Restored' && (
            <p className="restored-message">Power restored. Thank you for your patience!</p>
        )}
        
        {ticketData.status === 'NoFaultFound' && (
            <p className="nff-message">Our crew checked your report. No fault was found at the site. If the issue persists, please report again.</p>
        )}
        
        {ticketData.status === 'AccessDenied' && (
            <p className="access-denied-message">Our crew could not access the site. Please ensure someone is home for the next visit, or contact us to reschedule.</p>
        )}
        
        {ticketData.status === 'Unresolved' && (
            <p className="unresolved-message">We could not resolve at this time. We will contact you shortly. You may report again if the issue persists.</p>
        )}
        
        {['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) && ticketData.lineman_remarks && (
            <div className="lineman-remarks-preview">
                <label>Field Notes:</label>
                <p>{ticketData.lineman_remarks}</p>
            </div>
        )}
        
        <p>
    <strong>Reported By:</strong> {
        [ticketData.first_name, ticketData.middle_name, ticketData.last_name]
        .filter(Boolean)
        .join(' ') || "Name not provided"
    }
</p>
        
        <p>
            <strong>Date Reported:</strong> {formatToPhilippineTime(ticketData.created_at)}
        </p>
        
        <div className="concern-preview">
            <label>Your Concern:</label>
            <p>{ticketData.concern}</p>
        </div>
        
        {(ticketData.status === 'Unresolved' || ticketData.status === 'NoFaultFound' || ticketData.status === 'AccessDenied') && (
            <button type="button" className="btn-report-again" onClick={() => { setIsFlipped(false); setTicketData(null); setTrackingId(''); }}>
                Report Again
            </button>
        )}
    </div>
</div>
                        )}
                    </div>
                </div>
            </div>
            
            {showModal && createPortal(
                <TicketPopUp 
                    ticketId={generatedId} 
                    onClose={() => setShowModal(false)} 
                    onSendEmail={handleSendEmailCopy} 
                />,
                document.body
            )}
            {createPortal(
                <ConfirmModal
                    isOpen={showDuplicateModal}
                    onClose={handleDuplicateCancel}
                    onConfirm={handleDuplicateConfirm}
                    title="Potential Duplicate Detected"
                    message={pendingDuplicateData ? `We found ${pendingDuplicateData.duplicates.length} similar ticket(s) from your number in the last 24 hours:\n\n${pendingDuplicateData.duplicateList}\n\nYour existing ticket is already being processed. Do you still want to submit a NEW ticket?` : ''}
                    confirmLabel="Submit Anyway"
                    cancelLabel="Cancel"
                    variant="default"
                />,
                document.body
            )}
            <div style={{ paddingBottom: '100px' }}></div>
        </div>
    );
};

export default ReportaProblem;
