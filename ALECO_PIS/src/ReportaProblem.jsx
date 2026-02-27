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

    // --- Master State ---
    const [formData, setFormData] = useState({
        accountNumber: '',
        firstName: '',
        middleName: '',
        lastName: '',
        phoneNumber: '',
        address: '',
        location: '',
        category: '',
        concern: '',
        district: '',
        municipality: '',
        barangay: '',
        purok: ''
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

    // --- Backend: Submit Ticket ---
    const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. STRICT VALIDATION (Updated for Object compatibility)
    const mandatoryFields = [
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'phoneNumber', label: 'Phone Number' },
        { key: 'address', label: 'Street Address' },
        // Instead of validating 'location' as a string, we check the new columns
        { key: 'municipality', label: 'Municipality/City' },
        { key: 'barangay', label: 'Barangay' },
        { key: 'purok', label: 'Purok' },
        { key: 'category', label: 'Issue Category' },
        { key: 'concern', label: 'Issue Details' }
    ];

    for (const field of mandatoryFields) {
        const val = formData[field.key];
        
        // Safety check: Only trim if the value is a string
        const isInvalid = typeof val === 'string' ? val.trim() === "" : !val;

        if (isInvalid) {
            alert(`Error: The "${field.label}" is required. Please fill it out.`);
            return; 
        }
    }

    // 2. DATA PREPARATION
    const submissionData = new FormData();
    
    // Explicit mapping to match your new backend columns exactly
    submissionData.append('account_number', formData.accountNumber || "");
    submissionData.append('first_name', formData.firstName);
    submissionData.append('middle_name', formData.middleName || "");
    submissionData.append('last_name', formData.lastName);
    submissionData.append('phone_number', formData.phoneNumber);
    submissionData.append('address', formData.address);

    // NEW ANALYTICS COLUMNS
    submissionData.append('district', formData.district || "");
    submissionData.append('municipality', formData.municipality || "");
    submissionData.append('barangay', formData.barangay || "");
    submissionData.append('purok', formData.purok || "");

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
            
            // RESET FORM (Matches the new structure)
            setFormData({ 
                accountNumber: '', firstName: '', middleName: '', 
                lastName: '', phoneNumber: '', address: '', 
                category: '', concern: '', district: '', 
                municipality: '', barangay: '', purok: ''
            });
            setSelectedFile(null); 
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
                            <TextFieldProblem id="address" label="Full Address *" value={formData.address} onChange={handleFieldChange('address')} />
                            {/* NEW: AlecoScopeDropdown replaces the "Specific Landmark" free text field */}
                            <h3 className="column-section-title" style={{ marginTop: '30px' }}>Specific Area: (District/muni/brgy/purok)</h3>
                            <div className="dropdown-location-wrapper">
                                <AlecoScopeDropdown  
                                    onLocationSelect={handleLocationUpdate} 
                                />
                            </div>
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