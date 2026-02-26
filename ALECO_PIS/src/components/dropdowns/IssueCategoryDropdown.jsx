import React from 'react';
import '../../CSS/IssueCategoryDropdown.css'; // Connects to your CSS file

const IssueCategoryDropdown = ({ value, onChange }) => {
    return (
        <div className="issue-dropdown-container">
            <label className="issue-dropdown-label">
                Issue Category <span className="required-asterisk">*</span>
            </label>
            <select 
                className="issue-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
            >
                <option value="" disabled>Select the type of problem...</option>

                <optgroup label="1. No Light / Power Outage">
                    <option value="Residence No Power">Residence No Power</option>
                    <option value="Distribution XFormer / 1 Block No Light">Distribution XFormer / 1 Block No Light</option>
                    <option value="Primary Line No Power">Primary Line No Power</option>
                </optgroup>

                <optgroup label="2. Power Quality & Hazards">
                    <option value="Low Voltage">Low Voltage</option>
                    <option value="Fluctuating Voltage">Fluctuating Voltage</option>
                    <option value="Loose Connection">Loose Connection</option>
                    <option value="Cutoff Live Wire">Cutoff Live Wire</option>
                    <option value="Sagging Wire">Sagging Wire</option>
                </optgroup>

                <optgroup label="3. Pole & Distribution Line Complaints">
                    <option value="Rotten Pole">Rotten Pole</option>
                    <option value="Leaning Pole">Leaning Pole</option>
                    <option value="Clearing of Distribution Line">Clearing of Distribution Line</option>
                    <option value="Relocation of Pole/Line">Relocation of Pole/Line</option>
                    <option value="Distribution Xformer Replacement">Distribution Xformer Replacement</option>
                </optgroup>

                <optgroup label="4. Service Drop & Meter Concerns">
                    <option value="Check-up of KWHM">Check-up of KWHM</option>
                    <option value="Meter Calibration / Testing">Meter Calibration / Testing</option>
                    <option value="Transfer of KWHM">Transfer of KWHM</option>
                    <option value="Reroute Service Drop">Reroute Service Drop</option>
                    <option value="Change / Upgrade Service">Change / Upgrade Service</option>
                </optgroup>

                <optgroup label="5. Miscellaneous Requests">
                    <option value="Temporary Disconnection">Temporary Disconnection</option>
                    <option value="Temporary Lighting">Temporary Lighting</option>
                    <option value="Other / Unlisted Concern">Other / Unlisted Concern</option>
                </optgroup>
            </select>
        </div>
    );
};

export default IssueCategoryDropdown;