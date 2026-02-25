import React from 'react';
import PropTypes from 'prop-types';
import '../../CSS/ExplainTheProblem.css';

const ExplainTheProblem = ({ value, onChange }) => {
    return (
        <div className="concern-group">
            <label htmlFor="concern" className="concern-label">
                Describe your concern
            </label>
            <textarea 
                id="concern" 
                className="concern-field textarea-large" 
                placeholder="Please explain the problem in detail (e.g., specific pole numbers, wires sparking, etc.)..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            ></textarea>
        </div>
    );
};

ExplainTheProblem.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};

export default ExplainTheProblem;