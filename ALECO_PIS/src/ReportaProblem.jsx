import React from 'react';
import './CSS/ReportaProblem.css';

const ReportaProblem = () => {
    return (
        <div id="report" className="report-problem-container">
            <h2 className="report-title">Report a problem</h2>
            <p className="report-description">Brownouts, damaged posts, broken wires, etc.</p>

            <div className="report-main-card">
                <div className="report-content-wrapper">
                    
                    {/* LEFT COLUMN: User Info */}
                    <div className="report-form-column">
                        <div className="form__group_one">
                            <input type="text" id="acc_num" className="form__group_oneform__field" placeholder="Account Number" />
                            <label htmlFor="acc_num" className="form__group_oneform__label">Account Number</label>
                        </div>
                        <div className="form__group_one">
                            <input type="text" id="fname" className="form__group_oneform__field" placeholder="First Name" />
                            <label htmlFor="fname" className="form__group_oneform__label">First Name</label>
                        </div>
                        <div className="form__group_one">
                            <input type="text" id="mname" className="form__group_oneform__field" placeholder="Middle Name" />
                            <label htmlFor="mname" className="form__group_oneform__label">Middle Name</label>
                        </div>
                        <div className="form__group_one">
                            <input type="text" id="lname" className="form__group_oneform__field" placeholder="Last Name" />
                            <label htmlFor="lname" className="form__group_oneform__label">Last Name</label>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN: Concern & Location (Switched) */}
                    <div className="report-details-column">
                        <div className="concern-group">
                            <label htmlFor="concern" className="concern-label">Describe your concern</label>
                            <textarea 
                                id="concern" 
                                className="concern-field textarea-large" 
                                placeholder="Please explain the problem in detail (e.g., specific pole numbers, wires sparking, etc.)..."
                            ></textarea>
                        </div>

                        <div className="concern-group">
                            <label htmlFor="location" className="concern-label">Address and Location</label>
                            <input 
                                type="text" 
                                id="location" 
                                className="concern-field" 
                                placeholder="Enter the complete address" 
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The Upload Modal (Switched) */}
                    <div className="report-upload-column">
                        <div className="modal">
                            <div className="modal-header">
                                <div className="modal-logo">
                                    <span className="logo-circle">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 512 419.116">
                                            <path d="M16.991,419.116A16.989,16.989,0,0,1,0,402.125V16.991A16.989,16.989,0,0,1,16.991,0H146.124a17,17,0,0,1,10.342,3.513L227.217,57.77H437.805A16.989,16.989,0,0,1,454.8,74.761v53.244h40.213A16.992,16.992,0,0,1,511.6,148.657L454.966,405.222a17,17,0,0,1-16.6,13.332H410.053v.562ZM63.06,384.573H424.722L473.86,161.988H112.2Z" fill="#1cc972" />
                                        </svg>
                                    </span>
                                </div>
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