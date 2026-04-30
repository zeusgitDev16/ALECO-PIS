import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import '../../CSS/DispatchTicketModal.css';

const DispatchTicketModal = ({ isOpen, onClose, ticket, onSubmit, titleOverride, subtitleOverride, groupMainTicketId }) => {
    const [activeTab, setActiveTab] = useState('dispatch');
    // Form States
    const [crew, setCrew] = useState('');
    const [eta, setEta] = useState('');
    const [notifyConsumer, setNotifyConsumer] = useState(true);
    const [notes, setNotes] = useState('');
    
    // Database State
    const [availableCrews, setAvailableCrews] = useState([]);
    const [isLoadingCrews, setIsLoadingCrews] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);

    // --- FETCH CREWS ON OPEN (availableOnly for dispatch) ---
    useEffect(() => {
        if (isOpen) {
            setIsLoadingCrews(true);
            fetch(apiUrl('/api/crews/list?availableOnly=true'))
                .then(res => res.json())
                .then(data => {
                    setAvailableCrews(Array.isArray(data) ? data : []);
                })
                .catch(err => console.error("Failed to fetch crews:", err))
                .finally(() => setIsLoadingCrews(false));
        } else {
            // Reset form when modal closes
            setActiveTab('dispatch');
            setCrew('');
            setEta('');
            setNotes('');
            setNotifyConsumer(true);
            setGroupMembers([]);
        }
    }, [isOpen]);

    // --- FETCH GROUP MEMBERS when group dispatch (for Notify Consumer phone list) ---
    useEffect(() => {
        if (isOpen && groupMainTicketId) {
            fetch(apiUrl(`/api/tickets/group/${groupMainTicketId}`))
                .then(res => res.json())
                .then(data => {
                    const children = data?.success && data?.data?.children ? data.data.children : [];
                    setGroupMembers(children);
                })
                .catch(() => setGroupMembers([]));
        } else {
            setGroupMembers([]);
        }
    }, [isOpen, groupMainTicketId]);

    // Idempotent Guard
    if (!isOpen || !ticket) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (activeTab === 'concern') {
            onSubmit({
                resolution_mode: 'concern',
                is_consumer_notified: notifyConsumer,
                concern_resolution_notes: notes
            });
            return;
        }
        onSubmit({
            resolution_mode: 'dispatch',
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
                    <h2 className="dispatch-modal-header">{titleOverride || 'Start Resolution'}</h2>
                    <p className="dispatch-modal-subtitle">
                        {subtitleOverride || <>Choose how to resolve Ticket <span className="highlight-id">{ticket.ticket_id}</span></>}
                    </p>
                </div>

                <div className="dispatch-modal-tabs" role="tablist" aria-label="Resolution type">
                    <button
                        type="button"
                        role="tab"
                        className={`dispatch-modal-tab ${activeTab === 'dispatch' ? 'active' : ''}`}
                        aria-selected={activeTab === 'dispatch'}
                        onClick={() => setActiveTab('dispatch')}
                    >
                        Dispatch Crew
                    </button>
                    <button
                        type="button"
                        role="tab"
                        className={`dispatch-modal-tab ${activeTab === 'concern' ? 'active' : ''}`}
                        aria-selected={activeTab === 'concern'}
                        onClick={() => setActiveTab('concern')}
                    >
                        Concern
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dispatch-modal-body">
                        {activeTab === 'dispatch' && (
                            <>
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
                                            {isLoadingCrews ? '-- Loading Units... --' : availableCrews.length === 0 ? '-- No available crews --' : '-- Select Field Unit --'}
                                        </option>
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
                            </>
                        )}

                        <div className="dispatch-form-group">
                            <label>{activeTab === 'dispatch' ? 'Dispatch Notes / Operational Context' : 'Concern Resolution Notes'}</label>
                            <textarea
                                className="dispatch-form-textarea"
                                placeholder={activeTab === 'dispatch'
                                    ? 'e.g., Bring replacement 50kVA transformer...'
                                    : 'e.g., Concern clarified and guidance provided to consumer...'}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                required={activeTab === 'concern'}
                            />
                        </div>

                        {/* Custom UI Toggle Switch for Consumer Notification */}
                        <div className={`dispatch-form-group toggle-group ${!notifyConsumer ? 'notify-off' : ''}`}>
                            <label className="toggle-label">
                                <div className="toggle-text">
                                    <span className="toggle-title">Notify Consumer</span>
                                    <span className="toggle-desc">
                                        {activeTab === 'concern' ? (
                                            <>When ON, send consumer an SMS that their concern is now being handled</>
                                        ) : groupMembers.length > 0 ? (
                                            <>When ON, consumers with phone numbers will receive SMS when dispatched</>
                                        ) : (
                                            <>Send SMS update with ETA to {ticket.phone_number || 'the consumer'}</>
                                        )}
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
                            {groupMembers.length > 0 && (
                                <ul className="notify-consumer-ticket-list">
                                    {groupMembers.map((m) => {
                                        const hasPhone = !!(m.phone_number && String(m.phone_number).trim());
                                        return (
                                            <li key={m.ticket_id} className={`notify-consumer-ticket-item ${hasPhone ? 'has-phone' : 'no-phone'}`}>
                                                <span className="notify-ticket-id">{m.ticket_id}</span>
                                                <span className="notify-ticket-status">
                                                    {hasPhone ? (
                                                        <><span className="status-dot status-ok" /> Will receive SMS</>
                                                    ) : (
                                                        <><span className="status-dot status-missing" /> No phone number</>
                                                    )}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="dispatch-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-ongoing">
                            {activeTab === 'dispatch' ? 'Confirm Dispatch' : 'Start Concern Resolution'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

export default DispatchTicketModal;