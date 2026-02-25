import React, { useState } from 'react';
import './CSS/ReportaProblem.css';

// Importing the Lego Bricks
import TextFieldProblem from './components/textfields/TextFieldProblem';
import ExplainTheProblem from './components/textfields/ExplainTheProblem';
import UploadTheProblem from './components/buckets/UploadTheProblem';

const ReportaProblem = () => {
    // Master State for the entire form
    const [formData, setFormData] = useState({
        accountNumber: '',
        firstName: '',
        middleName: '',
        lastName: '',
        phoneNumber: '',
        address: '',
        location: '',
        concern: ''
    });

    // Universal handler to update specific fields
    const handleFieldChange = (field) => (value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Form submission handler (Ready for future backend wiring)
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("ALECO Ticket Data Prepared: ", formData);
        // TODO: Wire to Aiven MySQL backend later
    };

    return (
        <div id="report" className="report-problem-container">
            <div className="report-header-section">
                <h2 className="report-title">Report a Problem</h2>
                <p className="report-description">Brownouts, damaged posts, broken wires, etc.</p>
            </div>

            <form className="report-main-card" onSubmit={handleSubmit}>
                {/* LEFT COLUMN: Identity & Spatial Data */}
                <div className="report-form-column">
                    <h3 className="column-section-title">Contact Information</h3>
                    
                    <TextFieldProblem id="acc_num" label="Account Number *" placeholder="e.g. 123456789" value={formData.accountNumber} onChange={handleFieldChange('accountNumber')} filterType="numeric" maxLength={15} />
                    <TextFieldProblem id="fname" label="First Name *" placeholder="Juan" value={formData.firstName} onChange={handleFieldChange('firstName')} filterType="name" />
                    <TextFieldProblem id="mname" label="Middle Name" placeholder="Dela" value={formData.middleName} onChange={handleFieldChange('middleName')} filterType="name" />
                    <TextFieldProblem id="lname" label="Last Name *" placeholder="Cruz" value={formData.lastName} onChange={handleFieldChange('lastName')} filterType="name" />
                    <TextFieldProblem id="phone" label="Phone Number *" placeholder="09123456789" value={formData.phoneNumber} onChange={handleFieldChange('phoneNumber')} filterType="numeric" maxLength={11} />
                    
                    <h3 className="column-section-title" style={{ marginTop: '30px' }}>Location Details</h3>
                    <TextFieldProblem id="address" label="Full Address *" placeholder="House No., Street, Barangay" value={formData.address} onChange={handleFieldChange('address')} filterType="text" />
                    <TextFieldProblem id="location" label="Specific Landmark" placeholder="Near the blue gate..." value={formData.location} onChange={handleFieldChange('location')} filterType="text" />
                </div>

                {/* RIGHT COLUMN: Contextual Evidence */}
                <div className="report-details-column">
                    <h3 className="column-section-title">Issue Details</h3>
                    
                    <ExplainTheProblem value={formData.concern} onChange={handleFieldChange('concern')} />
                    
                    <div className="upload-wrapper">
                        <UploadTheProblem />
                    </div>
                    
                    {/* Main Form Submit Button */}
                    <div className="form-submit-row">
                        <button type="submit" className="btn-submit-report">Submit Report</button>
                    </div>
                </div>
            </form>
            
            <div style={{ paddingBottom: '100px' }}></div>
        </div>
    );
};

export default ReportaProblem;