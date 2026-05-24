import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import AlecoScopeDropdown from '../dropdowns/AlecoScopeDropdown';
import MapPinPicker from '../maps/MapPinPicker';
import UploadTheProblem from '../buckets/UploadTheProblem';
import TextFieldProblem from '../textfields/TextFieldProblem';
import PhoneInputProblem from '../textfields/PhoneInputProblem';
import '../../CSS/ManualTicketModal.css';
import '../../CSS/ManualTicketModalUIScale.css';

const DRAFT_STORAGE_KEY = 'manualTicketDrafts';
const MAX_DRAFTS = 15;

const ManualTicketModal = ({ isOpen, onClose, onRefetch }) => {
    const [formData, setFormData] = useState({
        account_number: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        phone_number: '',
        address: '',
        district: '',
        municipality: '',
        category: '',
        concern: '',
        action_desired: '',
        is_urgent: false,
        reported_lat: null,
        reported_lng: null,
        location_accuracy: null,
        location_method: 'manual',
        location_confidence: 'low',
        image_url: null
    });

    const [drafts, setDrafts] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const fileInputRef = useRef(null);

    // Toggle body class when map picker is open to prevent pointer events on manual ticket modal
    useEffect(() => {
        if (showMapPicker) {
            document.body.classList.add('map-picker-open');
        } else {
            document.body.classList.remove('map-picker-open');
        }
        return () => {
            document.body.classList.remove('map-picker-open');
        };
    }, [showMapPicker]);

    // Load drafts from localStorage on mount
    useEffect(() => {
        if (isOpen) {
            try {
                const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
                if (saved) {
                    setDrafts(JSON.parse(saved));
                }
            } catch (e) {
                console.error('Failed to load drafts:', e);
            }
        }
    }, [isOpen]);

    // Save drafts to localStorage whenever drafts change
    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
        } catch (e) {
            console.error('Failed to save drafts:', e);
        }
    }, [drafts]);

    const handleFieldChange = (field) => (value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGPSUpdate = (lat, lng, accuracy) => {
        setFormData(prev => ({
            ...prev,
            reported_lat: lat,
            reported_lng: lng,
            location_accuracy: accuracy,
            location_method: 'map_pin',
            location_confidence: 'high'
        }));
    };

    const handleClearGPS = () => {
        setFormData(prev => ({
            ...prev,
            reported_lat: null,
            reported_lng: null,
            location_accuracy: null,
            location_method: 'manual',
            location_confidence: 'low'
        }));
    };

    const handleFindMyLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Your browser does not support location services.');
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

                        let googleMunicipality = '';
                        let province = '';
                        let street = '';
                        let barangay = '';

                        components.forEach((comp) => {
                            if (comp.types.includes('route')) street = comp.long_name;
                            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) {
                                barangay = comp.long_name;
                            }
                            if (comp.types.includes('locality')) {
                                googleMunicipality = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_2')) {
                                if (!googleMunicipality) {
                                    googleMunicipality = comp.long_name;
                                }
                                province = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_1') && !province) {
                                province = comp.long_name;
                            }
                        });

                        // Build address string from street and barangay
                        const addressParts = [street, barangay].filter(Boolean);
                        const fullAddress = addressParts.length > 0
                            ? addressParts.join(', ')
                            : googleMunicipality || '';

                        // Relaxed validation for manual creation - allow outside Albay
                        // Set GPS coordinates, municipality, and auto-fill address
                        setFormData(prev => ({
                            ...prev,
                            reported_lat: latitude,
                            reported_lng: longitude,
                            location_accuracy: accuracy,
                            location_method: 'device_gps',
                            location_confidence: 'high',
                            municipality: googleMunicipality || prev.municipality,
                            address: fullAddress || prev.address
                        }));

                        toast.success('Location found successfully');
                    } else {
                        // Still set GPS even if geocoding fails
                        setFormData(prev => ({
                            ...prev,
                            reported_lat: latitude,
                            reported_lng: longitude,
                            location_accuracy: accuracy,
                            location_method: 'device_gps',
                            location_confidence: 'medium'
                        }));
                        toast.success('GPS coordinates captured');
                    }
                } catch (error) {
                    console.error('Geocoding error:', error);
                    // Still set GPS even if geocoding fails
                    setFormData(prev => ({
                        ...prev,
                        reported_lat: latitude,
                        reported_lng: longitude,
                        location_accuracy: accuracy,
                        location_method: 'device_gps',
                        location_confidence: 'medium'
                    }));
                    toast.success('GPS coordinates captured');
                }
                setIsLocating(false);
            },
            (error) => {
                console.error('GPS error:', error);
                setLocationError('Unable to get your location. Please enable location services.');
                setIsLocating(false);
                toast.error('Unable to get your location. Please enable location services.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const generateDraftId = () => `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const validateDraft = () => {
        if (!formData.first_name || !String(formData.first_name).trim()) {
            toast.error('First name is required');
            return false;
        }
        if (!formData.last_name || !String(formData.last_name).trim()) {
            toast.error('Last name is required');
            return false;
        }
        if (!formData.address || !String(formData.address).trim()) {
            toast.error('Address is required');
            return false;
        }
        if (!formData.concern || !String(formData.concern).trim()) {
            toast.error('Concern is required');
            return false;
        }
        if (!formData.category || !String(formData.category).trim()) {
            toast.error('Category is required');
            return false;
        }
        return true;
    };

    const handleSaveAndCreateAnother = () => {
        if (!validateDraft()) return;

        if (drafts.length >= MAX_DRAFTS) {
            toast.error(`Maximum ${MAX_DRAFTS} drafts allowed. Please save or delete some drafts first.`);
            return;
        }

        const draft = {
            draftId: generateDraftId(),
            ...formData,
            createdAt: new Date().toISOString()
        };

        setDrafts(prev => [...prev, draft]);
        toast.success('Draft saved. You can create another ticket.');

        // Clear form for next ticket
        setFormData({
            account_number: '',
            first_name: '',
            middle_name: '',
            last_name: '',
            phone_number: '',
            address: '',
            district: '',
            municipality: '',
            category: '',
            concern: '',
            action_desired: '',
            is_urgent: false,
            reported_lat: null,
            reported_lng: null,
            location_accuracy: null,
            location_method: 'manual',
            location_confidence: 'low',
            image_url: null
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDeleteDraft = (draftId) => {
        setDrafts(prev => prev.filter(d => d.draftId !== draftId));
        toast.success('Draft deleted');
    };

    const handleEditDraft = (draft) => {
        setFormData({
            account_number: draft.account_number || '',
            first_name: draft.first_name || '',
            middle_name: draft.middle_name || '',
            last_name: draft.last_name || '',
            phone_number: draft.phone_number || '',
            address: draft.address || '',
            district: draft.district || '',
            municipality: draft.municipality || '',
            category: draft.category || '',
            concern: draft.concern || '',
            action_desired: draft.action_desired || '',
            is_urgent: draft.is_urgent || false,
            reported_lat: draft.reported_lat,
            reported_lng: draft.reported_lng,
            location_accuracy: draft.location_accuracy,
            location_method: draft.location_method || 'manual',
            location_confidence: draft.location_confidence || 'low',
            image_url: draft.image_url || null
        });
        handleDeleteDraft(draft.draftId);
    };

    const handleSubmit = async () => {
        // Add current form to drafts if it has data
        const hasFormData = formData.first_name || formData.last_name || formData.concern || formData.category;
        if (hasFormData && validateDraft()) {
            if (drafts.length >= MAX_DRAFTS) {
                toast.error(`Maximum ${MAX_DRAFTS} drafts allowed. Please delete some drafts first.`);
                return;
            }
            const currentDraft = {
                draftId: generateDraftId(),
                ...formData,
                createdAt: new Date().toISOString()
            };
            setDrafts(prev => [...prev, currentDraft]);
        }

        if (drafts.length === 0) {
            toast.error('No tickets to save. Please fill in the form or add drafts.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Optimize: use bulk API if multiple drafts, single API if one
            const endpoint = drafts.length === 1
                ? apiUrl('/api/tickets/manual-create')
                : apiUrl('/api/tickets/manual-create/bulk');

            const payload = drafts.length === 1
                ? { ...drafts[0], image_url: drafts[0].image_url }
                : { tickets: drafts };

            const response = await authFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(data.message || 'Tickets created successfully');
                // Clear drafts
                setDrafts([]);
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                // Clear form
                setFormData({
                    account_number: '',
                    first_name: '',
                    middle_name: '',
                    last_name: '',
                    phone_number: '',
                    address: '',
                    district: '',
                    municipality: '',
                    category: '',
                    concern: '',
                    action_desired: '',
                    is_urgent: false,
                    reported_lat: null,
                    reported_lng: null,
                    location_accuracy: null,
                    location_method: 'manual',
                    location_confidence: 'low',
                    image_url: null
                });
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                onClose();
                if (onRefetch) onRefetch();
            } else {
                toast.error(data.message || 'Failed to create tickets');
            }
        } catch (error) {
            console.error('Manual creation error:', error);
            toast.error('Connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setDrafts([]);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        onClose();
    };

    const handleMinimize = () => {
        onClose();
        // Drafts remain in localStorage
        toast.info('Drafts saved. Reopen the modal to continue.');
    };

    if (!isOpen) return null;

    return (
        <div className="manual-ticket-modal-backdrop" onClick={handleMinimize}>
            <div className="manual-ticket-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Fixed Header */}
                <div className="manual-ticket-modal-header">
                    <div className="header-text-group">
                        <h2 className="header-title">Add Ticket</h2>
                        <p className="header-subtitle">Create tickets manually for reports from phone, email, or messenger</p>
                    </div>
                    <div className="header-actions">
                        <button
                            type="button"
                            className="header-minimize-btn"
                            onClick={handleMinimize}
                            title="Minimize (keep drafts)"
                        >
                            −
                        </button>
                        <button
                            type="button"
                            className="header-close-btn"
                            onClick={handleCancel}
                            title="Cancel (clear drafts)"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="manual-ticket-modal-content">
                    <div className="manual-ticket-form-layout">
                        {/* Left Column: Consumer Info */}
                        <div className="manual-ticket-form-column">
                            <h3 className="form-column-title">Consumer Information</h3>
                            
                            <div className="form-field">
                                <label>Account Number (Optional)</label>
                                <TextFieldProblem
                                    id="account_number"
                                    label=""
                                    value={formData.account_number}
                                    onChange={handleFieldChange('account_number')}
                                    filterType="numeric"
                                    maxLength={15}
                                    placeholder="Enter account number"
                                />
                            </div>

                            <div className="form-field">
                                <label>First Name *</label>
                                <TextFieldProblem
                                    id="first_name"
                                    label=""
                                    value={formData.first_name}
                                    onChange={handleFieldChange('first_name')}
                                    filterType="name"
                                    placeholder="Enter first name"
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>Middle Name (Optional)</label>
                                <TextFieldProblem
                                    id="middle_name"
                                    label=""
                                    value={formData.middle_name}
                                    onChange={handleFieldChange('middle_name')}
                                    filterType="name"
                                    placeholder="Enter middle name"
                                />
                            </div>

                            <div className="form-field">
                                <label>Last Name *</label>
                                <TextFieldProblem
                                    id="last_name"
                                    label=""
                                    value={formData.last_name}
                                    onChange={handleFieldChange('last_name')}
                                    filterType="name"
                                    placeholder="Enter last name"
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>Phone Number (Optional)</label>
                                <PhoneInputProblem
                                    id="phone_number"
                                    label=""
                                    value={formData.phone_number}
                                    onChange={handleFieldChange('phone_number')}
                                    placeholder="09XXXXXXXXX"
                                />
                            </div>

                            <div className="form-field">
                                <label>Address *</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => handleFieldChange('address')(e.target.value)}
                                    placeholder="Enter full address"
                                    rows={3}
                                    required
                                />
                            </div>
                        </div>

                        {/* Middle Column: Issue Details */}
                        <div className="manual-ticket-form-column">
                            <h3 className="form-column-title">Issue Details</h3>

                            <div className="form-field">
                                <label>Category *</label>
                                <IssueCategoryDropdown
                                    value={formData.category}
                                    onChange={handleFieldChange('category')}
                                    isFilter={false}
                                    layoutMode="form"
                                />
                            </div>

                            <div className="form-field">
                                <label>Concern *</label>
                                <textarea
                                    value={formData.concern}
                                    onChange={(e) => handleFieldChange('concern')(e.target.value)}
                                    placeholder="Describe the issue"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>Action Desired (Optional)</label>
                                <textarea
                                    value={formData.action_desired}
                                    onChange={(e) => handleFieldChange('action_desired')(e.target.value)}
                                    placeholder="What action is needed?"
                                    rows={2}
                                />
                            </div>

                            <div className="form-field">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_urgent}
                                        onChange={(e) => handleFieldChange('is_urgent')(e.target.checked)}
                                    />
                                    Mark as Urgent
                                </label>
                            </div>

                            <div className="form-field">
                                <label>Image (Optional)</label>
                                <UploadTheProblem
                                    selectedFile={selectedFile}
                                    setSelectedFile={setSelectedFile}
                                    onImageUpload={(url) => handleFieldChange('image_url')(url)}
                                />
                            </div>
                        </div>

                        {/* Right Column: Location + Drafts */}
                        <div className="manual-ticket-form-column">
                            <h3 className="form-column-title">Location</h3>

                            <div className="form-field">
                                <label>District & Municipality (Optional)</label>
                                <AlecoScopeDropdown
                                    initialDistrict={formData.district}
                                    initialMunicipality={formData.municipality}
                                    onLocationSelect={(loc) => {
                                        handleFieldChange('district')(loc?.district || '');
                                        handleFieldChange('municipality')(loc?.municipality || '');
                                    }}
                                />
                            </div>

                            <div className="form-field">
                                <label>GPS Location (Optional)</label>
                                <div className="gps-actions">
                                    <button
                                        type="button"
                                        className="btn-gps"
                                        onClick={handleFindMyLocation}
                                        disabled={isLocating}
                                    >
                                        {isLocating ? '📍 Locating...' : '📍 Find My Location'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-gps"
                                        onClick={() => setShowMapPicker(true)}
                                    >
                                        🗺️ Pin Location on Map
                                    </button>
                                    {formData.reported_lat && (
                                        <button
                                            type="button"
                                            className="btn-gps-clear"
                                            onClick={handleClearGPS}
                                        >
                                            ✖ Clear GPS
                                        </button>
                                    )}
                                </div>
                                {locationError && (
                                    <div className="gps-status" style={{ color: '#ef4444' }}>
                                        {locationError}
                                    </div>
                                )}
                                {formData.reported_lat && (
                                    <div className="gps-status">
                                        <span>Coords: {formData.reported_lat?.toFixed(6)}, {formData.reported_lng?.toFixed(6)}</span>
                                        {formData.location_accuracy && (
                                            <span> (±{formData.location_accuracy}m)</span>
                                        )}
                                        <span> • Method: {formData.location_method}</span>
                                    </div>
                                )}
                            </div>

                            {showMapPicker && createPortal(
                                <MapPinPicker
                                    initialLat={formData.reported_lat || 13.1353}
                                    initialLng={formData.reported_lng || 123.7443}
                                    onCancel={() => setShowMapPicker(false)}
                                    onConfirm={(lat, lng) => {
                                        handleGPSUpdate(lat, lng, null);
                                        setShowMapPicker(false);
                                    }}
                                />,
                                document.body
                            )}

                            <h3 className="form-column-title" style={{ marginTop: '24px' }}>
                                Draft Queue ({drafts.length}/{MAX_DRAFTS})
                            </h3>

                            <div className="draft-preview-list">
                                {drafts.length === 0 ? (
                                    <p className="draft-empty">No drafts yet. Fill the form and click "Save and Create Another".</p>
                                ) : (
                                    drafts.map((draft) => (
                                        <div key={draft.draftId} className="draft-item">
                                            <div className="draft-info">
                                                <span className="draft-id">{draft.draftId}</span>
                                                <span className="draft-name">
                                                    {draft.first_name} {draft.last_name}
                                                </span>
                                                <span className="draft-address">
                                                    {draft.address?.substring(0, 30)}{draft.address?.length > 30 ? '...' : ''}
                                                </span>
                                            </div>
                                            <div className="draft-actions">
                                                <button
                                                    type="button"
                                                    className="draft-edit-btn"
                                                    onClick={() => handleEditDraft(draft)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="draft-delete-btn"
                                                    onClick={() => handleDeleteDraft(draft.draftId)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="manual-ticket-modal-footer">
                    <button
                        type="button"
                        className="btn-footer btn-cancel"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-footer btn-save-another"
                        onClick={handleSaveAndCreateAnother}
                        disabled={isSubmitting}
                    >
                        Save and Create Another
                    </button>
                    <button
                        type="button"
                        className="btn-footer btn-save"
                        onClick={handleSubmit}
                        disabled={isSubmitting || drafts.length === 0}
                    >
                        {isSubmitting ? 'Saving...' : `Save (${drafts.length} ticket${drafts.length !== 1 ? 's' : ''})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualTicketModal;
