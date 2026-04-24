import React from 'react'; // Removed redundant useState
import { Link } from 'react-router-dom';
import '../CSS/Sidebar.css';
import alecoLogo from '../assets/Aleco-logo-modified.png';
import CreatePost from './buttons/CreatePost';

// Accept isOpen and toggleSidebar from AdminLayout
const AdminSidebar = ({ activePage, isOpen, toggleSidebar, onOpenServiceMemos }) => {
  
  // Safely close the sidebar only if it's currently open (Mobile behavior)
  const handleLinkClick = () => {
    if (isOpen) {
      toggleSidebar();
    }
  };

  const handleServiceMemosClick = () => {
    onOpenServiceMemos?.();
    handleLinkClick();
  };

  return (
    <>
      {/* The Glass Overlay (Clicking outside closes the menu) */}
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Dynamic Class applied here: ${isOpen ? 'open' : ''} */}
      <aside id="sidebar" className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-layout">
          {/* Fixed top: logo + title + separator */}
          <header className="sidebar-top">
            <div className="sidebar-header">
              <img src={alecoLogo} alt="Aleco Logo" className="sidebar-logo" />
              <h5>ALECO</h5>
            </div>
            <hr className="sidebar-separator" aria-hidden="true" />
          </header>

          {/* Scrollable middle: all nav links + section labels */}
          <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
            <div className="sidebar-menu">
              <Link to="/admin-dashboard" className={`sidebar-item ${activePage === 'home' ? 'active' : ''}`} onClick={handleLinkClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span>Home</span>
              </Link>
            </div>

            <span className="sidebar-label">Tools*</span>
            <div className="sidebar-nav-group">
            <Link to="/admin-users" className={`sidebar-item ${activePage === 'users' ? 'active' : ''}`} onClick={handleLinkClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Users</span>
            </Link>

              <Link to="/admin-personnel" className={`sidebar-item ${activePage === 'personnel' ? 'active' : ''}`} onClick={handleLinkClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <polyline points="17 11 19 13 23 9"></polyline>
                </svg>
                <span>Personnel</span>
              </Link>

              <Link to="/admin-b2b-mail" className={`sidebar-item ${activePage === 'b2b-mail' ? 'active' : ''}`} onClick={handleLinkClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                  <line x1="12" y1="13" x2="12" y2="20"></line>
                </svg>
                <span>B2B Mail</span>
              </Link>

            <Link to="/admin-tickets" className={`sidebar-item ${activePage === 'tickets' ? 'active' : ''}`} onClick={handleLinkClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Tickets</span>
            </Link>

            <span className="sidebar-label">Posts*</span>

            <Link to="/admin-interruptions" className={`sidebar-item ${activePage === 'interruptions' ? 'active' : ''}`} onClick={handleLinkClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Interruptions</span>
            </Link>

            <span className="sidebar-label">Archives*</span>

            <Link to="/admin-history" className={`sidebar-item ${activePage === 'history' ? 'active' : ''}`} onClick={handleLinkClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>History</span>
            </Link>

            <Link to="/admin-backup" className={`sidebar-item ${activePage === 'backup' ? 'active' : ''}`} onClick={handleLinkClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Data Management</span>
            </Link>
            </div>
          </nav>

          <footer className="sidebar-footer">
            <CreatePost onOpen={handleServiceMemosClick} />
          </footer>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;