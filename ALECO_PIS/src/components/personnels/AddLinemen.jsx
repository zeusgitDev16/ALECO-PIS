import React, { useState, useEffect } from 'react';
import { toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/AddLinemen.css'; 

const AddLinemen = ({ isOpen, onClose, onSave, initialData = null }) => {
    const [fullName, setFullName] = useState('');
    const [designation, setDesignation] = useState('Lineman');
    const [contactNo, setContactNo] = useState('');
    const [status, setStatus] = useState('Active');
    const [leaveStart, setLeaveStart] = useState('');
    const [leaveEnd, setLeaveEnd] = useState('');
    const [leaveReason, setLeaveReason] = useState('');

    useEffect(() => {
        if (initialData) {
            setFullName(initialData.full_name || '');
            setDesignation(initialData.designation || 'Lineman');
            setContactNo(toDisplayFormat(initialData.contact_no) || '');
            setStatus(initialData.status || 'Active');
            setLeaveStart(initialData.leave_start ? initialData.leave_start.slice(0, 10) : '');
            setLeaveEnd(initialData.leave_end ? initialData.leave_end.slice(0, 10) : '');
            setLeaveReason(initialData.leave_reason || '');
        } else {
            setFullName('');
            setDesignation('Lineman');
            setContactNo('');
            setStatus('Active');
            setLeaveStart('');
            setLeaveEnd('');
            setLeaveReason('');
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
            contact_no: contactNo,
            status,
            leave_start: status === 'Leave' ? leaveStart || null : null,
            leave_end: status === 'Leave' ? leaveEnd || null : null,
            leave_reason: status === 'Leave' ? leaveReason || null : null
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
                            type="tel" 
                            className="dispatch-form-input" 
                            placeholder="e.g. 09943917653" 
                            value={contactNo} 
                            onChange={e => setContactNo(e.target.value)} 
                            required 
                        />
                        <small className="form-hint">Enter 09XXXXXXXXX format (no +63 needed)</small>
                    </div>

                    <div className="dispatch-form-group">
                        <label>Status</label>
                        <select 
                            className="dispatch-form-input" 
                            value={status} 
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Leave">Leave of Absence</option>
                        </select>
                    </div>

                    {status === 'Leave' && (
                        <>
                            <div className="dispatch-form-group">
                                <label>Leave Start Date</label>
                                <input 
                                    type="date" 
                                    className="dispatch-form-input" 
                                    value={leaveStart} 
                                    onChange={e => setLeaveStart(e.target.value)} 
                                />
                            </div>
                            <div className="dispatch-form-group">
                                <label>Leave End Date</label>
                                <input 
                                    type="date" 
                                    className="dispatch-form-input" 
                                    value={leaveEnd} 
                                    onChange={e => setLeaveEnd(e.target.value)} 
                                />
                            </div>
                            <div className="dispatch-form-group">
                                <label>Leave Reason</label>
                                <input 
                                    type="text" 
                                    className="dispatch-form-input" 
                                    placeholder="e.g. Sick leave, Vacation" 
                                    value={leaveReason} 
                                    onChange={e => setLeaveReason(e.target.value)} 
                                />
                            </div>
                        </>
                    )}

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