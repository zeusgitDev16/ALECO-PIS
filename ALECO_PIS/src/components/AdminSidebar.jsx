import React from 'react';
import '../CSS/AdminSidebar.css';
import alecoLogo from '../assets/Aleco-logo-modified.png';

const AdminSidebar = () => {
  return (
    <aside id="sidebar" className="sidebar">
      <div className="sidebar-layout">
        <div className="sidebar-header">
          <img src={alecoLogo} alt="Aleco Logo" className="sidebar-logo" />
          <h5>ALECO</h5>
        </div>
        <hr className="sidebar-separator" />
        
        {/* Main Navigation */}
        <div className="sidebar-menu">
          <a href="#" className="sidebar-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
          </a>
        </div>

        <span className="sidebar-label">Tools*</span>
        <div className="sidebar-content">
          {/* Users */}
          <a href="#" className="sidebar-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Users</span>
          </a>

          {/* Tickets */}
          <a href="#" className="sidebar-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Tickets</span>
          </a>

          <span className="sidebar-label">Posts*</span>

          {/* Interruptions */}
          <a href="#" className="sidebar-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Interruptions</span>
          </a>

          <span className="sidebar-label">Archives*</span>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;