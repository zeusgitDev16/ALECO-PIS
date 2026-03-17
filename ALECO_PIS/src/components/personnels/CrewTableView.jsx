import React from 'react';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/PersonnelManagement.css';

/**
 * CrewTableView - Lego Brick: Table view for crews
 */
const CrewTableView = ({ crews, isLoading, onEditCrew }) => {
    if (isLoading) {
        return (
            <div className="users-table-container">
                <p style={{ fontSize: '0.7rem', color: '#888' }}>Loading crews...</p>
            </div>
        );
    }

    return (
        <div className="users-table-container">
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Crew Name</th>
                        <th>Lead Lineman</th>
                        <th>Members</th>
                        <th>Phone Number</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {crews.map(crew => (
                        <tr key={crew.id}>
                            <td className="user-email">{crew.crew_name}</td>
                            <td><span className="lead-badge">{crew.lead_lineman_name || 'Unassigned'}</span></td>
                            <td>{crew.members?.length || 0} Members</td>
                            <td><span className="phone-display">{formatPhoneDisplay(crew.phone_number) || toDisplayFormat(crew.phone_number) || crew.phone_number || '—'}</span></td>
                            <td><span className={`status-badge status-${(crew.status || 'Available').toLowerCase()}`}>{crew.status || 'Available'}</span></td>
                            <td>
                                <button className="action-btn-toggle" onClick={() => onEditCrew && onEditCrew(crew)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                    {crews.length === 0 && (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '15px' }}>No crews found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default CrewTableView;
