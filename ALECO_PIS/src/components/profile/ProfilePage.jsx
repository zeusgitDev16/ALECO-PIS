import React, { useState } from 'react';
import { FaEdit, FaSave, FaLock, FaHistory, FaFacebook, FaTwitter, FaGithub } from 'react-icons/fa';
import { apiUrl } from '../../utils/api';
import '../../CSS/ProfilePage.css';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [userData, setUserData] = useState({
    name: localStorage.getItem('userName') || 'User',
    email: localStorage.getItem('userEmail') || '',
    role: (localStorage.getItem('userRole') || 'ADMIN').toLowerCase(),
    pic: localStorage.getItem('googleProfilePic') || '',
    bio: localStorage.getItem('userBio') || 'ALECO-PIS System Administrator',
    address: localStorage.getItem('userAddress') || 'Albay, Philippines',
    phone: localStorage.getItem('userPhone') || '+63 000 000 0000'
  });

  const handleSaveProfile = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(apiUrl('/api/users/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email, name: userData.name })
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Failed to save profile.');
        setIsSaving(false);
        return;
      }
      localStorage.setItem('userName', userData.name);
      localStorage.setItem('userBio', userData.bio);
      localStorage.setItem('userAddress', userData.address);
      localStorage.setItem('userPhone', userData.phone);
      setIsEditing(false);
    } catch {
      alert('Network error. Profile name could not be saved to the server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-main-container">
      <header className="profile-header-text">
        <h1>Profile</h1>
        <p>View and manage your ALECO-PIS account details here.</p>
      </header>

      <div className="profile-grid-layout">
        {/* LEFT COLUMN: Overview Card */}
        <div className="profile-card sidebar-card">
          <div className="avatar-section">
            <div 
              className={`avatar-ring role-${userData.role}`} 
              onClick={() => setShowImageModal(true)}
              title="Click to view full image"
            >
              <img 
                src={userData.pic ? userData.pic.replace(/=s\d+(-c)?/g, '=s1024-c') : ''} 
                alt="Profile" 
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
          <div className="user-intro">
            {isEditing ? (
              <input 
                className="edit-input-field" 
                value={userData.name} 
                onChange={(e) => setUserData({...userData, name: e.target.value})} 
              />
            ) : <h2>{userData.name}</h2>}
            <span className={`role-pill ${userData.role}`}>{userData.role.toUpperCase()}</span>
          </div>
          
          <button className="edit-profile-btn" onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditing ? <><FaSave /> Save Profile</> : <><FaEdit /> Edit Profile</>}
          </button>
        </div>

        {/* RIGHT COLUMN: Bio & Details */}
        <div className="profile-card details-card">
          <div className="details-header-row">
            <h3>Account Details</h3>
            <span className="online-indicator"></span>
          </div>

          <div className="info-details-grid">
            <div className="info-group" style={{ gridColumn: 'span 2' }}>
              <label>Bio</label>
              {isEditing ? (
                <textarea 
                  className="edit-input-field" 
                  value={userData.bio} 
                  onChange={(e) => setUserData({...userData, bio: e.target.value})} 
                />
              ) : <p>{userData.bio}</p>}
            </div>
            <div className="info-group">
              <label>My Email</label>
              <p>{userData.email}</p>
            </div>
            <div className="info-group">
              <label>Phone Number</label>
              {isEditing ? (
                <input 
                  className="edit-input-field" 
                  value={userData.phone} 
                  onChange={(e) => setUserData({...userData, phone: e.target.value})} 
                />
              ) : <p>{userData.phone}</p>}
            </div>
            <div className="info-group" style={{ gridColumn: 'span 2' }}>
              <label>My Address</label>
              {isEditing ? (
                <input 
                  className="edit-input-field" 
                  value={userData.address} 
                  onChange={(e) => setUserData({...userData, address: e.target.value})} 
                />
              ) : <p>{userData.address}</p>}
            </div>
            <div className="info-group">
               <label><FaLock /> Security</label>
               <button type="button" className="change-pass-btn" onClick={() => alert('To change your password, please log out and use "Forgot Password" on the login page.')}>Change Password</button>
            </div>
          </div>
        </div>

        {/* NEW SEPARATE CONTAINERS AT THE BOTTOM */}
        <div className="profile-card social-media-container">
           <h3>Connect</h3>
           <div className="social-links-flex">
              <div className="social-item">
                 <FaFacebook className="social-icon" />
                 <span className="social-text">Facebook</span>
              </div>
              <div className="social-item">
                 <FaTwitter className="social-icon" />
                 <span className="social-text">Twitter</span>
              </div>
              <div className="social-item">
                 <FaGithub className="social-icon" />
                 <span className="social-text">GitHub</span>
              </div>
           </div>
           
        </div>

        <div className="profile-card activity-logs-container">
           <h3><FaHistory /> Activity Logs</h3>
           <ul className="activity-log-list">
              <li>Profile Updated <small>Just now</small></li>
              <li>Logged in <small>2 hours ago</small></li>
              <li>Password Changed <small>5 days ago</small></li>
           </ul>
        </div>
      </div>

      {/* FULL SCREEN IMAGE MODAL */}
      {showImageModal && (
        <div className="profile-image-modal" onClick={() => setShowImageModal(false)}>
          <img 
            // Replaces the thumbnail size param (e.g., s96-c) with high-res (s1024-c)
            src={userData.pic ? userData.pic.replace(/=s\d+(-c)?/g, '=s1024-c') : ''} 
            alt="Full Profile View" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
    
  );
};

export default ProfilePage;