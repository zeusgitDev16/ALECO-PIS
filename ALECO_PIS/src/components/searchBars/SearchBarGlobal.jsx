import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../CSS/SearchBarGlobal.css';

const SearchBarGlobal = () => {
  const [profilePic, setProfilePic] = useState('');
  const [role, setRole] = useState('employee');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // NEW: Secure feature state for global logout
  const [logoutAllDevices, setLogoutAllDevices] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const updateProfile = () => {
      const storedPic = localStorage.getItem('googleProfilePic');
      const storedRole = localStorage.getItem('userRole'); 
      
      if (storedPic && storedPic !== 'null' && storedPic !== 'undefined') {
        setProfilePic(storedPic);
      } else {
        setProfilePic('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'); 
      }

      if (storedRole) {
        setRole(storedRole.toLowerCase());
      } else {
        setRole('employee');
      }
    };

    updateProfile(); 
    window.addEventListener('storage', updateProfile);
    return () => window.removeEventListener('storage', updateProfile);
  }, []);

  // UPDATED: Async handleLogout to support the server-side global flush
  const handleLogout = async () => {
    try {
      if (logoutAllDevices) {
        // We retrieve the email to tell the server which account to flush
        const userEmail = localStorage.getItem('userEmail'); 
        
        if (userEmail) {
          await fetch('http://localhost:5000/api/logout-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
          });
          console.log("--- [SECURITY] Global session flush completed ---");
        }
      }
    } catch (error) {
      console.error("Global Logout Failed:", error);
      // We continue with local logout anyway to ensure the user is logged out of this session
    } finally {
      localStorage.clear(); 
      setIsDropdownOpen(false); 
      setShowLogoutConfirm(false);
      setLogoutAllDevices(false); // Reset state for next user
      navigate('/'); 
    }
  };

  return (
    <header className="admin-top-nav">
      <div className="search-container">
        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" className="search-input" placeholder="Search..." />
      </div>
      
      <div className="action-icons">
        <button className="icon-btn" title="Notifications">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>
        
        <button className="icon-btn" title="Inbox">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </button>
        
        <div className="profile-menu-wrapper">
          <button 
            className="profile-btn" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Account Menu"
          >
            <div className={`profile-image-border role-${role}`}>
              <img src={profilePic} alt="User" className="profile-image" referrerPolicy="no-referrer" />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-info">
                <span className="user-name">{localStorage.getItem('userName') || 'User'}</span>
                <span className="user-role">{role.toUpperCase()}</span>
              </div>
              <div className="dropdown-divider"></div>
              <button className="dropdown-link" onClick={() => navigate('/profile')}>View Profile</button>
              
              <button 
                className="dropdown-link logout-red" 
                onClick={() => {
                  setShowLogoutConfirm(true);
                  setIsDropdownOpen(false);
                }}
              >
                Logout
              </button>
            </div>
          )}

          {showLogoutConfirm && (
            <div className="logout-modal-overlay">
              <div className="logout-modal">
                <h3>Confirm Logout</h3>
                <p>Are you sure you want to sign out of the ALECO PIS?</p>
                
                {/* NEW: Security Checkbox UI */}
                <div className="security-option">
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={logoutAllDevices} 
                      onChange={(e) => setLogoutAllDevices(e.target.checked)} 
                    />
                    <span className="checkbox-label">Logout from all devices</span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="cancel-btn" onClick={() => {
                    setShowLogoutConfirm(false);
                    setLogoutAllDevices(false);
                  }}>Cancel</button>
                  <button className="confirm-btn" onClick={handleLogout}>Logout</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default SearchBarGlobal;