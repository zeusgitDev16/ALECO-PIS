import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../CSS/TextFieldProblem.css'; // The dedicated CSS file for this specific brick

const TextFieldProblem = ({ id, label, value, onChange, filterType, maxLength, placeholder }) => {
    const [hasError, setHasError] = useState(false);

    const handleChange = (e) => {
        let val = e.target.value;

        // Validation Logic
        if (filterType === 'numeric') {
            if (/[^0-9]/.test(val)) {
                setHasError(true);
                setTimeout(() => setHasError(false), 1500);
            }
            val = val.replace(/[^0-9]/g, '');
        } else if (filterType === 'name') {
            if (/[^a-zA-Z\s]/.test(val)) {
                setHasError(true);
                setTimeout(() => setHasError(false), 1500);
            }
            val = val.replace(/[^a-zA-Z\s]/g, '');
            val = val.replace(/\b\w/g, (char) => char.toUpperCase());
        }

        onChange(val);
    };

    return (
        <div className="textfield-group">
            <label htmlFor={id} className="textfield-label">
                {label}
            </label>
            <div className="textfield-input-wrapper">
                <input 
                    type="text" 
                    id={id} 
                    className={`textfield-input ${hasError ? 'error' : ''}`}
                    placeholder={placeholder}
                    value={value}
                    onChange={handleChange}
                    maxLength={maxLength}
                    autoComplete="off"
                />
                {hasError && (
                    <span className="textfield-error-msg">
                        {filterType === 'numeric' ? 'Numbers only' : 'Letters only'}
                    </span>
                )}
            </div>
        </div>
    );
};

TextFieldProblem.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    filterType: PropTypes.oneOf(['numeric', 'name', 'text']).isRequired,
    maxLength: PropTypes.number,
    placeholder: PropTypes.string
};

export default TextFieldProblem;