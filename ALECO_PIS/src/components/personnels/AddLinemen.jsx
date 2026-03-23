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
        <div className="personnel-modal-backdrop" onClick={onClose}>
            <div className="personnel-modal" onClick={(e) => e.stopPropagation()}>
                <div className="personnel-modal-header">
                    <div className="personnel-modal-title-wrap">
                        <h2 className="personnel-modal-title">
                            {initialData ? 'Edit Personnel' : 'Register Lineman'}
                        </h2>
                        <p className="personnel-modal-subtitle">
                            Add or update field operator details in the global pool.
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
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    className="personnel-modal-input"
                                    placeholder="e.g. Mark Anthony"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="personnel-modal-form-group">
                                <label>Designation</label>
                                <select
                                    className="personnel-modal-input"
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

                            <div className="personnel-modal-form-group">
                                <label>Personal Contact No.</label>
                                <input
                                    type="tel"
                                    className="personnel-modal-input"
                                    placeholder="e.g. 09943917653"
                                    value={contactNo}
                                    onChange={e => setContactNo(e.target.value)}
                                    required
                                />
                                <small className="form-hint">Philippine mobile: 09XXXXXXXXX, +63 9XX XXX XXXX, or 9XXXXXXXXX</small>
                            </div>

                            <div className="personnel-modal-form-group">
                                <label>Status</label>
                                <select
                                    className="personnel-modal-input"
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
                                    <div className="personnel-modal-form-group">
                                        <label>Leave Start Date</label>
                                        <input
                                            type="date"
                                            className="personnel-modal-input"
                                            value={leaveStart}
                                            onChange={e => setLeaveStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="personnel-modal-form-group">
                                        <label>Leave End Date</label>
                                        <input
                                            type="date"
                                            className="personnel-modal-input"
                                            value={leaveEnd}
                                            onChange={e => setLeaveEnd(e.target.value)}
                                        />
                                    </div>
                                    <div className="personnel-modal-form-group">
                                        <label>Leave Reason</label>
                                        <input
                                            type="text"
                                            className="personnel-modal-input"
                                            placeholder="e.g. Sick leave, Vacation"
                                            value={leaveReason}
                                            onChange={e => setLeaveReason(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="personnel-modal-footer">
                        <button type="submit" className="personnel-modal-btn personnel-modal-btn-submit">
                            {initialData ? 'Update Record' : 'Register Operator'}
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

export default AddLinemen;
