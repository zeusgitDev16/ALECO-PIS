import React from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/PersonnelManagement.css'; // Reusing dashboard styles for consistency

const B2BMail = () => {
  return (
    <AdminLayout activePage="b2b-mail">
      <div className="admin-page-container">
        <header className="dashboard-header-flex">
          <div className="header-content">
            <h2 className="header-title">B2B Mail</h2>
            <p className="header-subtitle">Perform A2P emails and manage corporate communications with ALECO partners.</p>
          </div>
        </header>

        <div className="main-content-card">
          <div className="placeholder-content" style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)',
            border: '2px dashed var(--border-color)',
            borderRadius: '8px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <h3>B2B Mail Interface Coming Soon</h3>
            <p>This module will allow secure A2P communication with registered business accounts (e.g., LGU, Corporate Partners).</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default B2BMail;
