import React from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelManagement.css';

/**
 * LinemanTableView - Lego Brick: Table view for linemen
 */
const LinemanTableView = ({ linemen, isLoading, onEditLineman }) => {
    if (isLoading) {
        return (
            <div className="users-table-container">
                <p style={{ fontSize: '0.7rem', color: '#888' }}>Loading linemen...</p>
            </div>
        );
    }

    return (
        <div className="users-table-container">
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Full Name</th>
                        <th>Designation</th>
                        <th>Contact No.</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {linemen.map(man => (
                        <tr key={man.id}>
                            <td className="user-email">{man.full_name}</td>
                            <td>{man.designation}</td>
                            <td><span className="phone-display">{formatPhoneDisplay(man.contact_no) || toDisplayFormat(man.contact_no) || man.contact_no || '—'}</span></td>
                            <td><span className={`status-badge status-${(man.status || 'Active').toLowerCase()}`}>{man.status || 'Active'}</span></td>
                            <td>
                                <button className="action-btn-toggle" onClick={() => onEditLineman && onEditLineman(man)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                    {linemen.length === 0 && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '15px' }}>No personnel found in the database.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default LinemanTableView;
