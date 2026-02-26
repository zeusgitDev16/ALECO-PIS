import React, { useState } from 'react';
import '../../CSS/TicketPopUp.css';

const TicketPopUp = ({ ticketId, onClose, onSendEmail }) => {
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleCopy = () => {
        if (!ticketId) return;
        navigator.clipboard.writeText(ticketId);
        alert("Ticket ID copied to clipboard!");
    };

    const handleSend = async () => {
    // 1. Prevent action if already loading
    if (loading) return;

    // 2. Existing Email Validation
    if (!email.includes('@')) {
        alert("Please enter a valid email address.");
        return;
    }

    // 3. Start Loading state
    setLoading(true);

    try {
        // 4. Trigger the email send
        // We wrap this in a Promise if onSendEmail isn't already async
        await onSendEmail(email, setEmailSent);
    } catch (error) {
        console.error("Submission failed:", error);
        alert("Something went wrong. Please try again.");
    } finally {
        // 5. Re-enable the button after process finishes
        setLoading(false);
    }
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
                            <button 
  type="button" 
  onClick={handleSend}
  disabled={loading}
  className={`flex items-center justify-center gap-2 px-6 py-2 rounded font-semibold text-white transition-all ${
    loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
  }`}
>
  {loading ? (
    <>
      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Sending...
    </>
  ) : (
    "Send"
  )}
</button>
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