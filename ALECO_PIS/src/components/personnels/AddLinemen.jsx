import React, { useState, useEffect } from 'react';
import '../../CSS/AddLinemen.css'; 

const AddLinemen = ({ isOpen, onClose, onSave, initialData = null }) => {
    // Real functional state
    const [fullName, setFullName] = useState('');
    const [designation, setDesignation] = useState('Lineman');
    const [contactNo, setContactNo] = useState('63');

    // Populate or reset form based on edit/add mode
    useEffect(() => {
        if (initialData) {
            setFullName(initialData.full_name || '');
            setDesignation(initialData.designation || 'Lineman');
            setContactNo(initialData.contact_no || '63');
        } else {
            setFullName('');
            setDesignation('Lineman');
            setContactNo('63');
        }
    }, [initialData, isOpen]);

    // Idempotent Guard
    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id || null,
            full_name: fullName,
            designation: designation,
            contact_no: contactNo
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
                        {initialData ? '👷 Edit Personnel' : '👷 Register Lineman'}
                    </h2>
                    <p className="dispatch-modal-subtitle">
                        Add or update field operator details in the global pool.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dispatch-form-group">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            className="dispatch-form-input" 
                            placeholder="e.g. Mark Anthony" 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="dispatch-form-group">
                        <label>Designation</label>
                        <select 
                            className="dispatch-form-input" 
                            value={designation} 
                            onChange={e => setDesignation(e.target.value)}
                            required
                        >
                            <option value="Lineman">Lineman</option>
                            <option value="Senior Lineman">Senior Lineman</option>
                            <option value="Driver">Driver</option>
                            <option value="Foreman">Foreman</option>
                        </select>
                    </div>

                    <div className="dispatch-form-group">
                        <label>Personal Contact No.</label>
                        <input 
                            type="text" 
                            className="dispatch-form-input" 
                            placeholder="63..." 
                            value={contactNo} 
                            onChange={e => setContactNo(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="dispatch-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-ongoing">
                            {initialData ? 'Update Record' : 'Register Operator'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default AddLinemen;