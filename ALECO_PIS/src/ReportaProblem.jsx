import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import './CSS/ReportaProblem.css';
import { apiUrl } from './utils/api';
import { useSiteSettings } from './context/SiteSettingsContext';
import { formatPhoneDisplay, INVALID_PHONE_HINT } from './utils/phoneUtils';
import { formatToPhilippineTime, formatToPhilippineTimeShort } from './utils/dateUtils';
import { formatTicketStatusLabel } from './utils/ticketStatusDisplay';
import { ALECO_SCOPE } from '../alecoScope';
import { matchGPSToAlecoScope, validateDistrictMunicipality } from './utils/gpsLocationMatcher';
import { getSafeResourceUrl } from './utils/safeUrl';

// Importing the Lego Bricks
import TextFieldProblem from './components/textfields/TextFieldProblem';
import PhoneInputProblem from './components/textfields/PhoneInputProblem';
import ExplainTheProblem from './components/textfields/ExplainTheProblem';
import ActionDesired from './components/textfields/ActionDesired';
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
import TicketHistoryLogs from './components/tickets/TicketHistoryLogs';

const TOTAL_STEPS = 6;

const ReportaProblem = () => {
    const { settings, smsCharLimits } = useSiteSettings();
    const reportTitle = settings?.public_report_title || 'Report a Problem';
    const reportSubtitle = settings?.public_report_subtitle || 'Brownouts, damaged posts, broken wires, etc.';
    const trackTitle = settings?.public_track_title || 'Track Your Ticket';
    const trackSubtitle = settings?.public_track_subtitle || 'See the real-time status of your concern.';

    // --- Wizard State ---
    const [currentStep, setCurrentStep] = useState(1);
    const stepContentRef = useRef(null);
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
    const [copiedField, setCopiedField] = useState(null);
    const [memoControlNumber, setMemoControlNumber] = useState('');
    const [memoStatus, setMemoStatus] = useState('');
    const [isMemoLoading, setIsMemoLoading] = useState(false);
    const [groupData, setGroupData] = useState(null);

    // --- Submission Job State ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionJobId, setSubmissionJobId] = useState(null);
    const [submissionStatus, setSubmissionStatus] = useState(null);

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
        actionDesired: '',
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

    const mapPickerCoords = useMemo(() => {
        const muniName = (formData.municipality || '').trim().toLowerCase();
        const districtName = (formData.district || '').trim().toLowerCase();
        let lat = 13.1353;
        let lng = 123.7443;
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
                    if (m.lat && m.lng) { lat = m.lat; lng = m.lng; }
                    break;
                }
            }
        }
        return { lat, lng };
    }, [formData.municipality, formData.district]);

    // --- OPTIMIZATION 1: Intelligent Municipality Autodetect ---
    useEffect(() => {
        if (gpsData.isLocked) return;
        const addr = (formData.address || '').trim().toLowerCase();
        if (!addr || addr.length < 3) return;

        for (const districtObj of ALECO_SCOPE) {
            for (const muniObj of districtObj.municipalities) {
                const muniName = muniObj.name.toLowerCase();
                const cleanMuni = muniName.replace(' city', '').trim();
                
                // Construct a regex to match the municipality name as a whole word
                const regex = new RegExp(`\\b${cleanMuni}\\b`, 'i');
                if (regex.test(addr)) {
                    if (formData.municipality !== muniObj.name) {
                        setFormData(prev => ({
                            ...prev,
                            district: districtObj.district,
                            municipality: muniObj.name
                        }));
                    }
                    return; // Match found, stop scanning
                }
            }
        }
    }, [formData.address, gpsData.isLocked]);

    const canProceed = useCallback((step) => {
        switch (step) {
            case 1: return !!formData.firstName?.trim() && !!formData.lastName?.trim() && !!formData.phoneNumber?.trim();
            case 2: return !!formData.concern?.trim() && !!formData.actionDesired?.trim();
            case 3: return true;
            case 4: return !!formData.category;
            case 5: return !!formData.address?.trim() && !!formData.municipality;
            case 6: return !!formData.category && !!formData.concern?.trim() && !!formData.actionDesired?.trim() && !!formData.firstName?.trim() && !!formData.lastName?.trim() && !!formData.phoneNumber?.trim() && !!formData.address?.trim() && !!formData.municipality;
            default: return false;
        }
    }, [formData]);

    useEffect(() => {
        if (stepContentRef.current) {
            stepContentRef.current.scrollTop = 0;
        }
    }, [currentStep]);

    const getStepState = (step) => {
        if (step < currentStep) return 'done';
        if (step === currentStep) return 'active';
        return 'pending';
    };

    // --- OPTIMIZATION 2: Proximity GPS Fallback (Offline / API Key failure recovery) ---
    const handleOfflineGPSFallback = (latitude, longitude, accuracy) => {
        console.log("ℹ️ [GPS FALLBACK] Geocoding API failed or offline. Using local proximity calculations...");
        
        let closestMuni = null;
        let closestDistrict = null;
        let minDistance = Infinity;
        
        for (const districtObj of ALECO_SCOPE) {
            for (const muniObj of districtObj.municipalities) {
                if (muniObj.lat && muniObj.lng) {
                    const dLat = latitude - muniObj.lat;
                    const dLng = longitude - muniObj.lng;
                    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                    
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestMuni = muniObj;
                        closestDistrict = districtObj.district;
                    }
                }
            }
        }
        
        // Approximate Albay province bounds: check if closest municipality is within 0.6 degrees (~66km)
        if (closestMuni && minDistance < 0.6) {
            console.log(`✅ [GPS FALLBACK] Closest municipality: ${closestMuni.name} (distance: ${minDistance.toFixed(4)})`);
            
            const fallbackAddress = `Approximate location in ${closestMuni.name} (GPS Geocoding Offline)`;
            
            setFormData(prev => ({
                ...prev,
                address: fallbackAddress,
                district: closestDistrict,
                municipality: closestMuni.name
            }));
            
            setGpsData({
                lat: latitude,
                lng: longitude,
                accuracy: Math.round(accuracy),
                method: 'gps',
                confidence: 'medium',
                isLocked: true
            });
            
            setLocationError('');
        } else {
            console.warn(`❌ [GPS FALLBACK] Nearest municipality is too far (${minDistance.toFixed(4)}). Outside serving area.`);
            setLocationError('❌ Location is outside Albay Province. ALECO only serves Albay.');
        }
        setIsLocating(false);
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
                        handleOfflineGPSFallback(latitude, longitude, accuracy);
                    }
                } catch (error) {
                    console.error('❌ [STEP 3 EXCEPTION] Geocoding Error:', error);
                    console.error('   Error Name:', error.name);
                    console.error('   Error Message:', error.message);
                    console.error('   Stack:', error.stack);
                    handleOfflineGPSFallback(latitude, longitude, accuracy);
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
        setIsSubmitting(true);
        setSubmissionStatus('submitting');

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
        // Only append GPS fields if they have actual values (omit if null to avoid FormData converting null to string 'null')
        if (gpsData.lat != null) submissionData.append('reported_lat', gpsData.lat);
        if (gpsData.lng != null) submissionData.append('reported_lng', gpsData.lng);
        if (gpsData.accuracy != null) submissionData.append('location_accuracy', gpsData.accuracy);
        submissionData.append('location_method', gpsData.method);
        submissionData.append('location_confidence', gpsData.confidence || 'medium');

        const kws =
            urgentKeywordsList === null ? DEFAULT_URGENT_KEYWORDS : urgentKeywordsList;
        const isUrgent = concernMatchesUrgentKeywords(formData.concern, kws);

        submissionData.append('is_urgent', isUrgent ? 1 : 0);

        submissionData.append('category', formData.category);
        submissionData.append('concern', formData.concern);
        submissionData.append('action_desired', formData.actionDesired);

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
                if (data.jobId) {
                    // New async flow: poll for job status
                    setSubmissionJobId(data.jobId);
                    setSubmissionStatus('queued');
                    pollJobStatus(data.jobId);
                } else if (data.ticketId) {
                    // Legacy flow (should not happen with new backend)
                    setGeneratedId(data.ticketId);
                    setShowModal(true);
                    setCurrentStep(1);
                    resetForm();
                }
            } else {
                toast.error("Submission failed: " + data.message);
                setIsSubmitting(false);
                setSubmissionStatus(null);
            }
        } catch (error) {
            console.error("Submission Error:", error);
            toast.error("Connection error. Is the server running?");
            setIsSubmitting(false);
            setSubmissionStatus(null);
        }
    };

    const pollJobStatus = async (jobId) => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(apiUrl(`/api/tickets/jobs/${jobId}`));
                const data = await response.json();

                if (data.success && data.job) {
                    const job = data.job;

                    if (job.status === 'pending' && job.queuePosition > 0) {
                        const waitText = job.estimatedWaitSeconds > 0
                            ? ` (~${job.estimatedWaitSeconds}s)`
                            : '';
                        setSubmissionStatus(`queued:${job.queuePosition}${waitText}`);
                    } else {
                        setSubmissionStatus(job.status);
                    }

                    if (job.status === 'completed' && job.ticketId) {
                        clearInterval(pollInterval);
                        setGeneratedId(job.ticketId);
                        setShowModal(true);
                        setCurrentStep(1);
                        resetForm();
                        setIsSubmitting(false);
                        setSubmissionJobId(null);
                        setSubmissionStatus(null);
                    } else if (job.status === 'failed') {
                        clearInterval(pollInterval);
                        toast.error("Submission failed: " + (job.error || 'Unknown error'));
                        setIsSubmitting(false);
                        setSubmissionJobId(null);
                        setSubmissionStatus(null);
                    }
                }
            } catch (error) {
                console.error("Polling error:", error);
                // Continue polling on error
            }
        }, 2000); // Poll every 2 seconds

        // Stop polling after 2 minutes (timeout)
        setTimeout(() => {
            clearInterval(pollInterval);
            if (isSubmitting) {
                toast.error("Submission timed out. Please try again.");
                setIsSubmitting(false);
                setSubmissionJobId(null);
                setSubmissionStatus(null);
            }
        }, 120000);
    };

    const resetForm = () => {
        setFormData({
            accountNumber: '', firstName: '', middleName: '',
            lastName: '', phoneNumber: '', address: '',
            category: '', concern: '', actionDesired: '', district: '',
            municipality: ''
        });
        setSelectedFile(null);
        setGpsData({ lat: null, lng: null, accuracy: null, method: 'manual', isLocked: false, confidence: 'low' });
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
            { key: 'concern', label: 'Issue Details' },
            { key: 'actionDesired', label: 'Action Desired' }
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
            console.log('Track ticket response:', result);
            if (result.success) {
                setTicketData(result.data);
                console.log('Ticket data:', result.data);
                console.log('Service memo ID:', result.data.service_memo_id);
                // Fetch memo data if service_memo_id exists
                if (result.data.service_memo_id) {
                    setIsMemoLoading(true);
                    try {
                        const memoRes = await fetch(apiUrl(`/api/service-memos/${result.data.service_memo_id}`));
                        const memoData = await memoRes.json();
                        console.log('Memo response:', memoData);
                        if (memoData.success) {
                            setMemoControlNumber(memoData.data.control_number || '');
                            setMemoStatus(memoData.data.memo_status || '');
                        } else {
                            console.error('Memo fetch failed:', memoData.message);
                        }
                    } catch (memoError) {
                        console.error('Failed to fetch memo:', memoError);
                    } finally {
                        setIsMemoLoading(false);
                    }
                } else {
                    setMemoControlNumber('');
                    setMemoStatus('');
                }
                // Fetch group data if it's a GROUP ticket
                if (result.data.ticket_id?.startsWith('GROUP-')) {
                    try {
                        const groupRes = await fetch(apiUrl(`/api/tickets/group/${result.data.ticket_id}`));
                        const groupResult = await groupRes.json();
                        if (groupResult.success) {
                            setGroupData(groupResult.data);
                        } else {
                            setGroupData(null);
                        }
                    } catch (groupError) {
                        console.error('Failed to fetch group data:', groupError);
                        setGroupData(null);
                    }
                } else {
                    setGroupData(null);
                }
            } else {
                toast.error(result.message);
                setTicketData(null);
                setMemoControlNumber('');
                setMemoStatus('');
                setGroupData(null);
            }
        } catch (error) {
            console.error("Tracking Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Copy to Clipboard ---
    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
        }).catch(err => console.error("Failed to copy text: ", err));
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
                        <h2 className="report-title">{reportTitle}</h2>
                        <p className="report-description">{reportSubtitle}</p>
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
                                { num: 1, label: 'Contact' },
                                { num: 2, label: 'Explain' },
                                { num: 3, label: 'Upload' },
                                { num: 4, label: 'Category' },
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
                        <div className="wizard-step-content" ref={stepContentRef}>
                            {currentStep === 1 && (
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

                            {currentStep === 2 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Explain the Problem</h3>
                                    <ExplainTheProblem value={formData.concern} onChange={handleFieldChange('concern')} maxLength={smsCharLimits.concern} />
                                    <ActionDesired value={formData.actionDesired} onChange={handleFieldChange('actionDesired')} maxLength={smsCharLimits.action} />
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
                                    <h3 className="column-section-title">Issue Category</h3>
                                    <IssueCategoryDropdown value={formData.category} onChange={handleFieldChange('category')} />
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div className="wizard-step-block">
                                    <h3 className="column-section-title">Address & Location Details</h3>
                                    
                                    {/* SECTION 1: ADDRESS DETAILS (MANDATORY) */}
                                    <div className="location-section-group">
                                        <h4 className="location-section-subtitle">1. Enter Address Details</h4>
                                        <TextFieldProblem
                                            id="address"
                                            label="Full Address *"
                                            value={formData.address}
                                            onChange={handleFieldChange('address')}
                                            placeholder={gpsData.isLocked ? "Auto-filled by GPS" : "Enter your street address / purok / landmarks"}
                                        />
                                        
                                        {(!gpsData.isLocked || locationError) && (
                                            <div className="aleco-scope-manual">
                                                <label className="column-section-title-dropdown">Select District & Municipality *</label>
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
                                    </div>
                                    
                                    {/* SECTION 2: MAP PINNING & ACCURACY (OPTIONAL) */}
                                    <div className="location-section-group accuracy-group">
                                        <h4 className="location-section-subtitle">2. Pin Exact Location (Optional)</h4>
                                        <p className="location-section-help">
                                            Providing coordinates helps our service crew locate the issue faster.
                                        </p>
                                        
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
                                                            toast.info('Please select a municipality first, then pin the exact spot on the map.');
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
                                    </div>
                                    
                                    {/* PIN STATUS BADGE */}
                                    <div className="location-status-badge-container">
                                        {gpsData.isLocked ? (
                                            <div className="location-success-box">
                                                <div className="gps-lock-info">
                                                    <span className="gps-lock-icon">✓</span>
                                                    <div>
                                                        <strong>
                                                            {gpsData.method === 'gps'
                                                                ? 'Precise location captured via GPS'
                                                                : gpsData.method === 'map_pin'
                                                                    ? 'Precise location captured via Map Pin'
                                                                    : 'Precise location captured'}
                                                        </strong>
                                                        <p className="gps-lock-details">
                                                            Coords: {gpsData.lat?.toFixed(6)}, {gpsData.lng?.toFixed(6)}
                                                            {gpsData.accuracy != null && ` (Accuracy: ±${gpsData.accuracy}m)`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={handleClearGPS} className="location-clear-btn">✖ Remove Pin</button>
                                            </div>
                                        ) : (
                                            <div className="location-info-box">
                                                <span className="gps-info-icon">ℹ</span>
                                                <span className="gps-info-text">
                                                    No precise coordinates captured. The map will default to your municipality's center.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* PREVIEW MAP */}
                                    {(gpsData.method === 'gps' || gpsData.method === 'map_pin') && gpsData.lat && gpsData.lng && (
                                        <LocationPreviewMap
                                            latitude={gpsData.lat}
                                            longitude={gpsData.lng}
                                            accuracy={gpsData.accuracy}
                                            municipality={formData.municipality}
                                            district={formData.district}
                                            method={gpsData.method}
                                        />
                                    )}
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
                                        disabled={!canProceed(6) || isSubmitting}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSubmit(e);
                                        }}
                                    >
                                        {isSubmitting ? (
                                            <span>
                                                {submissionStatus === 'submitting' && 'Submitting...'}
                                                {typeof submissionStatus === 'string' && submissionStatus.startsWith('queued:') && `Queue #${submissionStatus.replace('queued:', '')}`}
                                                {submissionStatus === 'processing' && 'Processing...'}
                                                {(!submissionStatus || submissionStatus === 'queued') && 'Queued...'}
                                            </span>
                                        ) : 'Submit Report'}
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
                        <h2 className="report-title">{trackTitle}</h2>
                        <p className="report-description">{trackSubtitle}</p>
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
        
        {/* STEP 2: Ongoing */}
        <div className={`step ${['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>
            <div className={`circle blue-glow ${['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) ? 'active' : ''}`}>2</div>
            <span>Ongoing</span>
        </div>
        
        {/* STEP 3: Closed (Restored, NoFaultFound, AccessDenied, Unresolved) */}
        <div className={`step ${['Restored', 'NoFaultFound', 'AccessDenied', 'Unresolved'].includes(ticketData.status) ? 'active' : ''}`}>
            <div className={`circle ${
                ticketData.status === 'Restored' ? 'green-glow' :
                ticketData.status === 'Unresolved' ? 'red-glow' :
                ticketData.status === 'NoFaultFound' ? 'violet-glow' :
                ticketData.status === 'AccessDenied' ? 'orange-glow' :
                'green-glow'
            } ${['Restored', 'NoFaultFound', 'AccessDenied', 'Unresolved'].includes(ticketData.status) ? 'active' : ''}`}>3</div>
            <span>Closed</span>
        </div>
    </div>

    <div className="status-details-scroll">
    <div className="status-details-card">
        <p className="status-row">
            <strong>Current Status:</strong> 
            <span className={`status-tag ${(ticketData.status || '').toLowerCase()}`}>{formatTicketStatusLabel(ticketData.status)}</span>
        </p>
        
        {/* Service Memo Status */}
        <p className="status-row">
            <strong>Service Memo:</strong> 
            <span className="memo-link-highlight">
                {isMemoLoading ? 'Loading...' : (memoStatus || 'No Service Memo yet')}
            </span>
        </p>
        
        {/* Account Number */}
        {ticketData.account_number && (
            <div className="copyable-box" onClick={() => handleCopy(ticketData.account_number, 'account')}>
                <strong>Account Number:</strong> 
                <span>{ticketData.account_number}</span>
                <span className={`copy-indicator ${copiedField === 'account' ? 'success' : ''}`}>
                    {copiedField === 'account' ? '✓ Copied' : '📋 Copy'}
                </span>
            </div>
        )}
        
        {/* Contact Number (copyable) */}
        <p className="status-row">
            <strong>Contact Number:</strong> 
            <span>{ticketData.phone_number}</span>
            <span className={`copy-indicator ${copiedField === 'phone' ? 'success' : ''}`} onClick={() => handleCopy(ticketData.phone_number, 'phone')}>
                {copiedField === 'phone' ? '✓ Copied' : '📋 Copy'}
            </span>
        </p>
        
        {/* Full Address Details */}
        <p>
            <strong>Service Location:</strong> 
            <span className="location-text">
                📍 {ticketData.address ? `${ticketData.address}, ` : ''}
                {ticketData.municipality || '—'}
                <br />
                <small className="district-sub">{ticketData.district || ''}</small>
            </span>
        </p>
        
        {/* Map Location */}
        {ticketData.reported_lat && ticketData.reported_lng && (
            <div className="map-location-section">
                <strong>Map Location:</strong>
                <p className="coordinates">
                    Coords: {Number(ticketData.reported_lat).toFixed(6)}, {Number(ticketData.reported_lng).toFixed(6)}
                    {ticketData.location_accuracy != null && ` (Accuracy: ±${ticketData.location_accuracy}m)`}
                </p>
                <a
                    className="ticket-map-external-link"
                    href={`https://maps.google.com/?q=${ticketData.reported_lat},${ticketData.reported_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View on Google Maps
                </a>
            </div>
        )}
        
        {/* Action Desired */}
        <div className="concern-preview">
            <label>Action Desired:</label>
            <p>{ticketData.action_desired || '—'}</p>
        </div>
        
        {/* Dispatch Info */}
        {(ticketData.assigned_crew || ticketData.eta || ticketData.dispatch_notes || ticketData.concern_resolution_notes) && ['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticketData.status) && (
            <div className="dispatch-info-section">
                <label>{ticketData.concern_resolution_notes ? 'Resolution Info' : 'Dispatch Info'}</label>
                <div className="dispatch-info-box">
                    {ticketData.assigned_crew && <p><strong>Crew:</strong> {ticketData.assigned_crew}</p>}
                    {ticketData.eta && <p><strong>ETA:</strong> {ticketData.eta}</p>}
                    {ticketData.dispatch_notes && <p><strong>Notes:</strong> {ticketData.dispatch_notes}</p>}
                    {ticketData.concern_resolution_notes && <p><strong>Concern Notes:</strong> {ticketData.concern_resolution_notes}</p>}
                </div>
            </div>
        )}
        
        {ticketData.status === 'Ongoing' && (ticketData.assigned_crew || ticketData.eta) && (
            <div className="crew-eta-info">
                {ticketData.assigned_crew && <p><strong>Crew dispatched:</strong> {ticketData.assigned_crew}</p>}
                {ticketData.eta && <p><strong>ETA:</strong> {ticketData.eta}</p>}
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
        
        {/* Attached Evidence */}
        {ticketData.image_url && (
            <div className="evidence-section">
                <label>Attached Evidence:</label>
                <div className="image-wrapper">
                    <img 
                        src={getSafeResourceUrl(ticketData.image_url)} 
                        alt="Evidence" 
                        className="evidence-img" 
                        onClick={() => window.open(getSafeResourceUrl(ticketData.image_url), '_blank', 'noopener,noreferrer')}
                    />
                    <span className="image-hint">Click image to expand</span>
                </div>
            </div>
        )}
        
        {/* Group Ticket Info */}
        {ticketData.ticket_id?.startsWith('GROUP-') && groupData?.children && groupData.children.length > 0 && (
            <div className="group-children-section">
                <label>Child Tickets ({groupData.children.length}):</label>
                <ul className="group-children-list">
                    {groupData.children.map((c) => {
                        const childLocation = c.municipality
                            ? `${c.municipality}, ${c.district || 'Albay'}`
                            : (c.address || '—');
                        const statusKey = c.status ? c.status.toLowerCase().replace(/\s/g, '') : 'pending';
                        return (
                            <li key={c.ticket_id} className="group-child-item">
                                <div className="group-child-top">
                                    <span className="child-id">{c.ticket_id}</span>
                                    <span className="child-category">{c.category}</span>
                                </div>
                                <div className="card-footer-metadata group-child-foot">
                                    <div className="location-scroll-wrapper">
                                        <span className="location-text-full">{childLocation}</span>
                                    </div>
                                    <span className={`status-pill-solid ${statusKey}`}>
                                        {formatTicketStatusLabel(c.status)}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        )}
        
        {(ticketData.status === 'Unresolved' || ticketData.status === 'NoFaultFound' || ticketData.status === 'AccessDenied') && (
            <button type="button" className="btn-report-again" onClick={() => { setIsFlipped(false); setTicketData(null); setTrackingId(''); }}>
                Report Again
            </button>
        )}
    </div>
    </div>
</div>
                        )}
                    </div>
                </div>
            </div>
            
            {showMapPicker && createPortal(
                <MapPinPicker
                    initialLat={mapPickerCoords.lat}
                    initialLng={mapPickerCoords.lng}
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
                />,
                document.body
            )}
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
