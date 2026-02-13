import React from 'react';
import './CSS/ReportaProblem.css';

const ReportaProblem = () => {
   return (
    <div id = "report" className="report-problem-container">
        <h2 className="report-title">Report a problem</h2>
        <p className="report-description">
            Brownouts, damaged posts, broken wires, etc.
        </p>

        {/* This container will now stack items vertically */}
        <div className="report-form-column">
            {/* Account Number */}
            <div className="form__group_one">
                <input type="text" id="acc_num" className="form__group_oneform__field" placeholder="Account Number" />
                <label htmlFor="acc_num" className="form__group_oneform__label">Account Number</label>
            </div>
            {/* First Name */}
            <div className="form__group_one">
                <input type="text" id="fname" className="form__group_oneform__field" placeholder="First Name" />
                <label htmlFor="fname" className="form__group_oneform__label">First Name</label>
            </div>
             {/* Middle Name */}
            <div className="form__group_one">
                <input type="text" id="mname" className="form__group_oneform__field" placeholder="Middle Name" />
                <label htmlFor="mname" className="form__group_oneform__label">Middle Name</label>
            </div>
             {/* Last Name */}
            <div className="form__group_one">
                <input type="text" id="lname" className="form__group_oneform__field" placeholder="Last Name" />
                <label htmlFor="lname" className="form__group_oneform__label">Last Name</label>
            </div>

        </div>
        
        {/* The big space at the bottom you requested */}
        <div style={{ paddingBottom: '150px' }}></div>
    </div>
);
}

export default ReportaProblem;