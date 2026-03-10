import React, { useState, useEffect } from 'react';
// We will create/update the CSS file in the next step, using the dispatch-modal class names.
import '../../CSS/AddCrew.css';

const AddCrew = ({ isOpen, onClose, onSave, linemenPool = [], initialData = null }) => {
    // Real functional state
    const [crewName, setCrewName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('63');
    const [members, setMembers] = useState([]);
    const [leadId, setLeadId] = useState(null);

    // Populate or reset form based on edit/add mode
    useEffect(() => {
        if (initialData) {
            setCrewName(initialData.crew_name || '');
            setPhoneNumber(initialData.phone_number || '63');
            setMembers(initialData.members || []);
            setLeadId(initialData.lead_id || null);
        } else {
            setCrewName('');
            setPhoneNumber('63');
            setMembers([]);
            setLeadId(null);
        }
    }, [initialData, isOpen]);

    // Idempotent Guard
    if (!isOpen) return null;

    const handleToggleMember = (id) => {
        const isMember = members.includes(id);
        const newMembers = isMember ? members.filter(m => m !== id) : [...members, id];
        const newLead = (isMember && leadId === id) ? null : leadId;
        
        setMembers(newMembers);
        setLeadId(newLead);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id || null,
            crew_name: crewName,
            phone_number: phoneNumber,
            members: members,
            lead_id: leadId
        });
    };

    return (
        <div className="dispatch-modal-overlay" onClick={onClose}>
            <div className="dispatch-modal-content" onClick={(e) => e.stopPropagation()}>
                
                <button className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">
                    &times;
                </button>

                <div className="dispatch-modal-header-container">
                    <h2 className="dispatch-modal-header">
                        {initialData ? '🛠️ Edit Field Unit' : '🛠️ Assemble Field Unit'}
                    </h2>
                    <p className="dispatch-modal-subtitle">
                        Configure team members and assign a unit leader.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dispatch-form-group">
                        <label>Crew / Unit Name</label>
                        <input 
                            type="text" 
                            className="dispatch-form-input" 
                            placeholder="e.g. Alpha-01" 
                            value={crewName} 
                            onChange={e => setCrewName(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="dispatch-form-group">
                        <label>Dispatch Hotline</label>
                        <input 
                            type="text" 
                            className="dispatch-form-input" 
                            placeholder="63..." 
                            value={phoneNumber} 
                            onChange={e => setPhoneNumber(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="dispatch-form-group">
                        <label>Personnel Selection (Pool)</label>
                        {/* We will style this to match the recessed look of dispatch-form-input in the CSS phase */}
                        <div className="personnel-selection-grid">
                            {linemenPool.length === 0 ? (
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No personnel available.</p>
                            ) : (
                                linemenPool.map(man => (
                                    <div 
                                        key={man.id} 
                                        className={`personnel-card ${members.includes(man.id) ? 'selected' : ''}`}
                                        onClick={() => handleToggleMember(man.id)}
                                    >
                                        <span className="personnel-name">{man.full_name}</span>
                                        {members.includes(man.id) && (
                                            <button 
                                                type="button"
                                                className={`lead-toggle-btn ${leadId === man.id ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLeadId(man.id);
                                                }}
                                            >
                                                {leadId === man.id ? '⭐ LEAD' : 'SET LEAD'}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="dispatch-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-ongoing">
                            {initialData ? 'Update Unit' : 'Deploy Unit'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default AddCrew;