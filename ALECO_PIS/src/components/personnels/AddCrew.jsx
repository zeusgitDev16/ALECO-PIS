import React, { useState, useEffect } from 'react';
import { toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/AddCrew.css';

const formatContact = (contact) => toDisplayFormat(contact) || contact || '';

const AddCrew = ({ isOpen, onClose, onSave, linemenPool = [], initialData = null }) => {
    const [crewName, setCrewName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [members, setMembers] = useState([]);
    const [leadId, setLeadId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (initialData) {
            setCrewName(initialData.crew_name || '');
            setPhoneNumber(toDisplayFormat(initialData.phone_number) || '');
            setMembers(initialData.members ? initialData.members.map(Number) : []);
            setLeadId(initialData.lead_id ? Number(initialData.lead_id) : null);
        } else {
            setCrewName('');
            setPhoneNumber('');
            setMembers([]);
            setLeadId(null);
        }
        setSearchQuery('');
    }, [initialData, isOpen]);

    const filteredPool = searchQuery.trim()
        ? linemenPool.filter(man =>
            (man.full_name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
        : linemenPool;

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
        if (members.length === 0) {
            alert('Crew must have at least one member. Please select personnel from the pool.');
            return;
        }
        onSave({
            id: initialData?.id || null,
            crew_name: crewName,
            phone_number: phoneNumber,
            members: members,
            lead_id: leadId
        });
    };

    return (
        <div className="personnel-modal-backdrop" onClick={onClose}>
            <div className="personnel-modal" onClick={(e) => e.stopPropagation()}>
                <div className="personnel-modal-header">
                    <div className="personnel-modal-title-wrap">
                        <h2 className="personnel-modal-title">
                            {initialData ? 'Edit Field Unit' : 'Assemble Field Unit'}
                        </h2>
                        <p className="personnel-modal-subtitle">
                            Configure team members and assign a unit leader.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="personnel-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>

                <form className="personnel-modal-form" onSubmit={handleSubmit}>
                    <div className="personnel-modal-scroll-outer">
                        <div className="personnel-modal-body-scroll">
                            <div className="personnel-modal-form-group">
                                <label>Crew / Unit Name</label>
                                <input
                                    type="text"
                                    className="personnel-modal-input"
                                    placeholder="e.g. Alpha-01"
                                    value={crewName}
                                    onChange={e => setCrewName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="personnel-modal-form-group">
                                <label>Dispatch Hotline</label>
                                <input
                                    type="tel"
                                    className="personnel-modal-input"
                                    placeholder="e.g. 09943917653"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    required
                                />
                                <small className="form-hint">Philippine mobile: 09XXXXXXXXX, +63 9XX XXX XXXX, or 9XXXXXXXXX</small>
                            </div>

                            <fieldset className="personnel-pool-fieldset">
                                <legend>
                                    Personnel Selection
                                    {members.length > 0 && (
                                        <span className="personnel-selection-count">{members.length} selected</span>
                                    )}
                                </legend>
                                <input
                                    type="text"
                                    className="personnel-search-input"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    aria-label="Search personnel by name"
                                />
                                <ul className="personnel-list" role="list">
                                    {filteredPool.length === 0 ? (
                                        <li className="personnel-list-empty">
                                            {linemenPool.length === 0 ? 'No personnel available.' : 'No matches for your search.'}
                                        </li>
                                    ) : (
                                        filteredPool.map(man => {
                                            const isInactive = ['inactive', 'leave'].includes((man.status || 'Active').toLowerCase());
                                            const isSelected = members.includes(man.id);
                                            const isLead = leadId === man.id;
                                            return (
                                                <li
                                                    key={man.id}
                                                    className={`personnel-list-item ${isSelected ? 'selected' : ''} ${isInactive ? 'inactive' : ''}`}
                                                    onClick={() => !isInactive && handleToggleMember(man.id)}
                                                    title={isInactive ? 'Inactive linemen cannot be added to crews' : (isSelected ? 'Click to remove from crew' : 'Click to add to crew')}
                                                >
                                                    <span className={`personnel-list-check ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                                                        {isSelected ? '✓' : ''}
                                                    </span>
                                                    <span className="personnel-list-name">
                                                        {isLead && <span className="personnel-list-lead-mark" title="Unit leader">★</span>}
                                                        {man.full_name}
                                                        {man.contact_no && <span className="personnel-list-contact">{formatContact(man.contact_no)}</span>}
                                                        {isInactive && <span className="personnel-list-inactive">(inactive)</span>}
                                                    </span>
                                                    {isSelected && (
                                                        <button
                                                            type="button"
                                                            className={`personnel-list-lead-btn ${isLead ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setLeadId(isLead ? null : man.id);
                                                            }}
                                                            title={isLead ? 'Remove as leader' : 'Set as leader'}
                                                        >
                                                            {isLead ? '★' : 'Lead'}
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            </fieldset>
                        </div>
                    </div>

                    <div className="personnel-modal-footer">
                        <button type="submit" className="personnel-modal-btn personnel-modal-btn-submit">
                            {initialData ? 'Update Unit' : 'Deploy Unit'}
                        </button>
                        <button type="button" className="personnel-modal-btn personnel-modal-btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddCrew;
