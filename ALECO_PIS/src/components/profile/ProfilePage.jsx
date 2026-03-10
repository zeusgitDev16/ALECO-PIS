import React, { useState, useEffect } from 'react';
import '../../CSS/ProfilePage.css';
// Note: You may need to run 'npm install react-icons' if you haven't yet
import { FaYoutube, FaInstagram, FaTiktok, FaEdit, FaLock, FaHistory, FaCheckCircle } from 'react-icons/fa';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: localStorage.getItem('userName') || 'Aezy Millete',
    email: localStorage.getItem('userEmail') || 'admin@orohigh.com',
    role: (localStorage.getItem('userRole') || 'ADMIN').toLowerCase(),
    pic: localStorage.getItem('googleProfilePic') || '',
    bio: "Passionate about the Oro High Portal project.",
    address: "Albay, Philippines",
    phone: "+63 912 345 6789"
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEdit = () => {
    if (isEditing) {
      // Logic to save to localStorage or Backend would go here
      console.log("Saved:", userData);
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="profile-master-container">
      <header className="profile-main-header">
        <h1>Profile</h1>
        <p>View and manage all your profile details here.</p>
      </header>

      <div className="profile-responsive-grid">
        {/* LEFT SIDEBAR */}
        <div className={`profile-glass-card sidebar-area role-border-${userData.role}`}>
          <div className="user-identity">
            <h2>{userData.name}</h2>
            <span className={`role-label ${userData.role}`}>
              {userData.role === 'admin' ? 'Premium Admin' : 'Official Employee'}
            </span>
          </div>

          <div className="avatar-container">
            <div className={`avatar-frame frame-${userData.role}`}>
              <img src={userData.pic} alt="User" referrerPolicy="no-referrer" />
            </div>
          </div>

          <div className="sidebar-nav-buttons">
            <button className="nav-btn edit-btn" onClick={toggleEdit}>
              <FaEdit /> {isEditing ? "Save Changes" : "Edit Profile"}
            </button>
            <button className="nav-btn"><FaLock /> Change Password</button>
            <button className="nav-btn"><FaHistory /> Activity Logs</button>
          </div>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="profile-glass-card details-area">
          <div className="details-top-bar">
            <h3>Bio & Other Details</h3>
            <div className="online-status">
              <span className="status-pulse"></span>
            </div>
          </div>

          <div className="details-input-grid">
            <div className="input-group">
              <label>My Role</label>
              <p className="static-text role-highlight">{userData.role.toUpperCase()}</p>
            </div>
            <div className="input-group">
              <label>My Email</label>
              <p className="static-text">{userData.email}</p>
            </div>
            
            <div className="input-group full-span">
              <label>Bio</label>
              {isEditing ? (
                <textarea name="bio" value={userData.bio} onChange={handleInputChange} className="edit-input" />
              ) : <p className="static-text">{userData.bio}</p>}
            </div>

            <div className="input-group">
              <label>City or Region</label>
              {isEditing ? (
                <input name="address" value={userData.address} onChange={handleInputChange} className="edit-input" />
              ) : <p className="static-text">{userData.address}</p>}
            </div>

            <div className="input-group">
              <label>Phone Number</label>
              {isEditing ? (
                <input name="phone" value={userData.phone} onChange={handleInputChange} className="edit-input" />
              ) : <p className="static-text">{userData.phone}</p>}
            </div>

            <div className="input-group">
              <label>Availability</label>
              <div className="collab-badge">
                <FaCheckCircle /> Available for Collaboration
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOCIAL FOOTER */}
      <footer className="profile-social-footer">
        <h4>Social Media & Links</h4>
        <div className="social-links-container">
          <a href="#" className="social-pill yt"><FaYoutube /> YouTube</a>
          <a href="#" className="social-pill ig"><FaInstagram /> Instagram</a>
          <a href="#" className="social-pill tk"><FaTiktok /> TikTok</a>
        </div>
      </footer>
    </div>
  );
};

export default ProfilePage;