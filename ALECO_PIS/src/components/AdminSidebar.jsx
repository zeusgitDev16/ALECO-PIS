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
          {/* Menu items will go here */}
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;