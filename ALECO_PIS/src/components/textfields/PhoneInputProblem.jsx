import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { validatePhilippineMobile, sanitizePhoneDigits } from '../../utils/phoneUtils';
import '../../CSS/TextFieldProblem.css';
import '../../CSS/PhoneInputProblem.css';

/**
 * Format digits as 09XX XXX XXXX for display
 */
const formatForDisplay = (digits) => {
    if (!digits || digits.length === 0) return '';
    let d = sanitizePhoneDigits(digits);
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('63') && d.length >= 11) d = '0' + d.slice(2, 12);
    else if (d.startsWith('9') && d.length === 10) d = '0' + d;
    else if (d.length > 11) d = d.slice(0, 11);
    if (d.length <= 4) return d;
    if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`;
};

const PhoneInputProblem = ({ id, label, value, onChange, placeholder }) => {
    const [touched, setTouched] = useState(false);
    const [showError, setShowError] = useState(false);

    const digits = sanitizePhoneDigits(value || '');
    const validation = validatePhilippineMobile(value || '');
    const hasError = touched && !validation.valid && digits.length > 0;

    const handleChange = useCallback((e) => {
        let val = sanitizePhoneDigits(e.target.value);
        if (val.startsWith('00')) val = val.slice(2);
        if (val.startsWith('63') && val.length >= 11) {
            val = '0' + val.slice(2, 12);
        } else if (val.startsWith('9') && val.length === 10) {
            val = '0' + val;
        } else if (val.length > 11) {
            val = val.slice(0, 11);
        }
        onChange(val);
        setShowError(false);
    }, [onChange]);

    const handleBlur = useCallback(() => {
        setTouched(true);
        if (digits.length > 0 && !validation.valid) {
            setShowError(true);
        }
    }, [digits.length, validation.valid]);

    const handleFocus = useCallback(() => {
        setShowError(false);
    }, []);

    const displayValue = formatForDisplay(digits);

    return (
        <div className="textfield-group phone-input-group">
            <label htmlFor={id} className="textfield-label">
                {label}
            </label>
            <div className="textfield-input-wrapper">
                <input
                    type="tel"
                    id={id}
                    className={`textfield-input phone-input-input ${hasError ? 'error' : ''}`}
                    placeholder={placeholder || '09XX XXX XXXX or +63 9XX XXX XXXX'}
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    maxLength={14}
                    autoComplete="tel"
                    inputMode="numeric"
                />
                {hasError && validation.error && (
                    <span className="textfield-error-msg phone-input-error">
                        {validation.error}
                    </span>
                )}
            </div>
        </div>
    );
};

PhoneInputProblem.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string
};

export default PhoneInputProblem;
