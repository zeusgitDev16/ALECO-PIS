import React, { useState, useEffect } from 'react';
import '../../CSS/DispatchTicketModal.css'; 

const DispatchTicketModal = ({ isOpen, onClose, ticket, onSubmit }) => {
    // Form States
    const [crew, setCrew] = useState('');
    const [eta, setEta] = useState('');
    const [notifyConsumer, setNotifyConsumer] = useState(true);
    const [notes, setNotes] = useState('');
    
    // Database State
    const [availableCrews, setAvailableCrews] = useState([]);
    const [isLoadingCrews, setIsLoadingCrews] = useState(false);

    // --- FETCH CREWS ON OPEN ---
    useEffect(() => {
        if (isOpen) {
            setIsLoadingCrews(true);
            fetch('http://localhost:5000/api/crews/list')
                .then(res => res.json())
                .then(data => {
                    // Make sure it's an array, and optionally you could filter out 'Offline' crews here if needed
                    setAvailableCrews(Array.isArray(data) ? data : []);
                })
                .catch(err => console.error("Failed to fetch crews:", err))
                .finally(() => setIsLoadingCrews(false));
        } else {
            // Reset form when modal closes
            setCrew('');
            setEta('');
            setNotes('');
            setNotifyConsumer(true);
        }
    }, [isOpen]);

    // Idempotent Guard
    if (!isOpen || !ticket) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("1. Dispatch Modal Submitted!");
        // Bundles the new dispatch data to send to the backend
        onSubmit({ 
            assigned_crew: crew, 
            eta: eta, 
            is_consumer_notified: notifyConsumer, 
            dispatch_notes: notes 
        });
    };

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content" onClick={(e) => e.stopPropagation()}>
                
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">
                    &times;
                </button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">🚚 Dispatch Crew</h2>
                    <p className="dispatch-modal-subtitle">
                        Assign field unit for Ticket <span className="highlight-id">{ticket.ticket_id}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dispatch-form-group">
                        <label>Assigned Crew / Unit</label>
                        <select 
                            className="dispatch-form-input" 
                            value={crew} 
                            onChange={e => setCrew(e.target.value)} 
                            required
                            disabled={isLoadingCrews}
                        >
                            <option value="">
                                {isLoadingCrews ? '-- Loading Units... --' : '-- Select Field Unit --'}
                            </option>
                            
                            {/* --- FULLY CONNECTED DYNAMIC LOOP --- */}
                            {availableCrews.map((c) => (
                                <option key={c.id} value={c.crew_name}>
                                    {c.crew_name} ({c.lead_lineman_name || 'No Lead'}) - {c.member_count} Members
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dispatch-form-group">
                        <label>Estimated Time of Arrival (ETA)</label>
                        <input 
                            type="text" 
                            className="dispatch-form-input" 
                            placeholder="e.g., 45 mins, 1.5 hours..." 
                            value={eta} 
                            onChange={e => setEta(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="dispatch-form-group">
                        <label>Dispatch Notes / Operational Context</label>
                        <textarea 
                            className="dispatch-form-textarea" 
                            placeholder="e.g., Bring replacement 50kVA transformer..." 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                        />
                    </div>

                    {/* Custom UI Toggle Switch for Consumer Notification */}
                    <div className="dispatch-form-group toggle-group">
                        <label className="toggle-label">
                            <div className="toggle-text">
                                <span className="toggle-title">Notify Consumer</span>
                                <span className="toggle-desc">
                                    Send SMS update with ETA to {ticket.phone_number || 'the consumer'}
                                </span>
                            </div>
                            <div className="toggle-switch-wrapper">
                                <input 
                                    type="checkbox" 
                                    className="toggle-checkbox" 
                                    checked={notifyConsumer} 
                                    onChange={e => setNotifyConsumer(e.target.checked)} 
                                />
                                <div className="toggle-switch"></div>
                            </div>
                        </label>
                    </div>

                    <div className="dispatch-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-ongoing">
                            Confirm Dispatch
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

export default DispatchTicketModal;