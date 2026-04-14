import React from 'react';
import PropTypes from 'prop-types';
import '../../CSS/ExplainTheProblem.css';

const ActionDesired = ({ value, onChange }) => {
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
                onChange={(e) => onChange(e.target.value)}
            ></textarea>
        </div>
    );
};

ActionDesired.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};

export default ActionDesired;
