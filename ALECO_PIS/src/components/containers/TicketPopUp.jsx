import React, { useState } from 'react';
import '../../CSS/TicketPopUp.css';

const TicketPopUp = ({ ticketId, onClose, onSendEmail }) => {
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);

    const handleCopy = () => {
        if (!ticketId) return;
        navigator.clipboard.writeText(ticketId);
        alert("Ticket ID copied to clipboard!");
    };

    const handleSend = () => {
        if (!email.includes('@')) {
            alert("Please enter a valid email address.");
            return;
        }
        // onSendEmail is passed from ReportaProblem.jsx
        onSendEmail(email, setEmailSent);
    };

    return (
        <div className="modal-overlay">
            <div className="success-modal-card">
                <div className="modal-header">
                    <div className="success-icon-check">✓</div>
                    <h2>Report Submitted!</h2>
                </div>
                
                <p className="modal-text">Please keep your tracking number for future reference:</p>
                
                <div className="ticket-display-box">
                    <span className="ticket-number">{ticketId || "Generating..."}</span>
                    <button type="button" className="copy-btn" onClick={handleCopy} title="Copy to clipboard">
                        📋
                    </button>
                </div>

                {!emailSent ? (
                    <div className="email-copy-section">
                        <p className="small-text">Want a copy via email?</p>
                        <div className="email-input-group">
                            <input 
                                type="email" 
                                placeholder="Enter your Gmail" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <button type="button" onClick={handleSend}>Send</button>
                        </div>
                    </div>
                ) : (
                    <p className="email-success-msg">Check your inbox! Copy sent.</p>
                )}

                <button type="button" className="btn-close-modal" onClick={onClose}>Done</button>
            </div>
        </div>
    );
};

export default TicketPopUp;