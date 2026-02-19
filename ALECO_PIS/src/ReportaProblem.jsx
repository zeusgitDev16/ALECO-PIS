import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './CSS/ReportaProblem.css';

// --- NEW COMPONENT: Validated Input with Filtering ---
const ValidatedInput = ({ id, label, value, onChange, filterType, maxLength, placeholder }) => {
    const [hasError, setHasError] = useState(false);

    const handleChange = (e) => {
        let val = e.target.value;

        if (filterType === 'numeric') {
            // Check for invalid characters (letters/symbols) to trigger error state
            if (/[^0-9]/.test(val)) {
                setHasError(true);
                setTimeout(() => setHasError(false), 1500);
            }
            // Security: Remove any non-digit characters
            val = val.replace(/[^0-9]/g, '');
        } else if (filterType === 'name') {
            // Security: Remove numbers and special characters (allow letters and spaces)
            val = val.replace(/[^a-zA-Z\s]/g, '');
            // Formatting: Capitalize the first letter of every word
            val = val.replace(/\b\w/g, (char) => char.toUpperCase());
        }

        onChange(val);
    };

    return (
        <div className="form__group_one">
            <input 
                type="text" 
                id={id} 
                className="form__group_oneform__field" 
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                maxLength={maxLength}
                autoComplete="off"
                style={hasError ? { border: '1px solid red', outline: '1px solid red' } : {}}
            />
            <label htmlFor={id} className="form__group_oneform__label">{label}</label>
            {hasError && <span style={{ color: 'red', fontSize: '12px', marginTop: '5px', display: 'block' }}>Numbers only</span>}
        </div>
    );
};

// Using PropTypes for filtering definition as requested
ValidatedInput.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    filterType: PropTypes.oneOf(['numeric', 'name', 'text']).isRequired,
    maxLength: PropTypes.number,
    placeholder: PropTypes.string
};

const ReportaProblem = () => {
    // State to manage the controlled inputs
    const [formData, setFormData] = useState({
        accountNumber: '',
        firstName: '',
        middleName: '',
        lastName: '',
        phoneNumber: '',
        address: '',
        location: ''
    });

    const handleFieldChange = (field) => (value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div id="report" className="report-problem-container">
            <h2 className="report-title">Report a problem</h2>
            <p className="report-description">Brownouts, damaged posts, broken wires, etc.</p>

            <div className="report-main-card">
                <div className="report-content-wrapper">
                    
                    {/* LEFT COLUMN: User Info */}
                    <div className="report-form-column">
                        <ValidatedInput 
                            id="acc_num"
                            label="Account Number"
                            placeholder="Account Number"
                            value={formData.accountNumber}
                            onChange={handleFieldChange('accountNumber')}
                            filterType="numeric"
                            maxLength={15}
                        />
                        <ValidatedInput 
                            id="phone"
                            label="Phone Number"
                            placeholder="Phone Number"
                            value={formData.phoneNumber}
                            onChange={handleFieldChange('phoneNumber')}
                            filterType="numeric"
                            maxLength={11}
                        />
                        <ValidatedInput 
                            id="fname"
                            label="First Name"
                            placeholder="First Name"
                            value={formData.firstName}
                            onChange={handleFieldChange('firstName')}
                            filterType="name"
                        />
                        <ValidatedInput 
                            id="mname"
                            label="Middle Name"
                            placeholder="Middle Name"
                            value={formData.middleName}
                            onChange={handleFieldChange('middleName')}
                            filterType="name"
                        />
                        <ValidatedInput 
                            id="lname"
                            label="Last Name"
                            placeholder="Last Name"
                            value={formData.lastName}
                            onChange={handleFieldChange('lastName')}
                            filterType="name"
                        />
                    </div>

                    {/* MIDDLE COLUMN: Concern & Location */}
                    <div className="report-details-column">
                        <div className="concern-group">
                            <label htmlFor="concern" className="concern-label">Describe your concern</label>
                            <textarea 
                                id="concern" 
                                className="concern-field textarea-large" 
                                placeholder="Please explain the problem in detail (e.g., specific pole numbers, wires sparking, etc.)..."
                            ></textarea>
                        </div>
                        <ValidatedInput 
                            id="address"
                            label="Address"
                            placeholder="Address"
                            value={formData.address}
                            onChange={handleFieldChange('address')}
                            filterType="text"
                        />
                        <ValidatedInput 
                            id="location"
                            label="Location"
                            placeholder="Location"
                            value={formData.location}
                            onChange={handleFieldChange('location')}
                            filterType="text"
                        />
                    </div>

                    {/* RIGHT COLUMN: The Upload Modal */}
                    <div className="report-upload-column">
                        <div className="modal">
                           <div className="modal-header">
                                
                            </div>
                            <div className="modal-body">
                                <p className="modal-title">Upload a picture</p>
                                <p className="modal-description">pictures about the problem</p>
                                <button className="upload-area">
                                    <span className="upload-area-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 340.531 419.116">
                                            <path d="M-2904.708-8.885A39.292,39.292,0,0,1-2944-48.177V-388.708A39.292,39.292,0,0,1-2904.708-428h209.558a13.1,13.1,0,0,1,9.3,3.8l78.584,78.584a13.1,13.1,0,0,1,3.8,9.3V-48.177a39.292,39.292,0,0,1-39.292,39.292Zm-13.1-379.823V-48.177a13.1,13.1,0,0,0,13.1,13.1h261.947a13.1,13.1,0,0,0,13.1-13.1V-323.221h-52.39a26.2,26.2,0,0,1-26.194-26.195v-52.39h-196.46A13.1,13.1,0,0,0-2917.805-388.708Zm146.5,241.621a14.269,14.269,0,0,1-7.883-12.758v-19.113h-68.841c-7.869,0-7.87-47.619,0-47.619h68.842v-18.8a14.271,14.271,0,0,1,7.882-12.758,14.239,14.239,0,0,1,14.925,1.354l57.019,42.764c.242.185.328.485.555.671a13.9,13.9,0,0,1,2.751,3.292,14.57,14.57,0,0,1,.984,1.454,14.114,14.114,0,0,1,1.411,5.987,14.006,14.006,0,0,1-1.411,5.973,14.653,14.653,0,0,1-.984,1.468,13.9,13.9,0,0,1-2.751,3.293c-.228.2-.313.485-.555.671l-57.019,42.764a14.26,14.26,0,0,1-8.558,2.847A14.326,14.326,0,0,1-2771.3-147.087Z" transform="translate(2944 428)" fill="#1cc972" />
                                        </svg>
                                    </span>
                                    <span className="upload-area-title">Drag file(s) here to upload.</span>
                                    <span className="upload-area-description">
                                        Alternatively, you can select a file by <br /><strong>clicking here</strong>
                                    </span>
                                </button>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary">Cancel</button>
                                <button className="btn-primary">Upload</button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <div style={{ paddingBottom: '150px' }}></div>
        </div>
    );
};

export default ReportaProblem;