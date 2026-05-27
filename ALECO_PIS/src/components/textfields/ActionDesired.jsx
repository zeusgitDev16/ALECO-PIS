import React from 'react';
import PropTypes from 'prop-types';
import '../../CSS/ExplainTheProblem.css';

const ActionDesired = ({ value, onChange, maxLength }) => {
    const handleChange = (e) => {
        const newValue = e.target.value;
        if (maxLength && newValue.length > maxLength) {
            onChange(newValue.slice(0, maxLength));
        } else {
            onChange(newValue);
        }
    };

    const remainingChars = maxLength ? maxLength - value.length : null;

    return (
        <div className="concern-group">
            <label htmlFor="action_desired" className="concern-label">
                Action desired
            </label>
            <textarea 
                id="action_desired" 
                className="concern-field textarea-large" 
                placeholder="What specific action would you like us to take?"
                value={value}
                onChange={handleChange}
                maxLength={maxLength}
            ></textarea>
            {maxLength !== null && (
                <div className="char-counter">
                    <span className={remainingChars < 0 ? 'char-counter--error' : ''}>
                        {remainingChars >= 0 ? `${remainingChars} characters remaining` : `${Math.abs(remainingChars)} characters over limit`}
                    </span>
                </div>
            )}
        </div>
    );
};

ActionDesired.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    maxLength: PropTypes.number,
};

export default ActionDesired;
