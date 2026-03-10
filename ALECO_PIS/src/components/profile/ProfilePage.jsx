import React, { useState } from 'react';
import { FaEdit, FaSave, FaLock, FaHistory, FaFacebook, FaTwitter, FaGithub } from 'react-icons/fa';
import '../../CSS/ProfilePage.css';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: localStorage.getItem('userName') || 'Aezy Millete',
    email: localStorage.getItem('userEmail') || '',
    role: (localStorage.getItem('userRole') || 'ADMIN').toLowerCase(),
    pic: localStorage.getItem('googleProfilePic') || '',
    bio: localStorage.getItem('userBio') || 'ALECO-PIS System Administrator',
    address: localStorage.getItem('userAddress') || 'Albay, Philippines',
    phone: localStorage.getItem('userPhone') || '+63 000 000 0000'
  });

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
            <div className={`avatar-ring role-${userData.role}`}>
              <img src={userData.pic} alt="Profile" referrerPolicy="no-referrer" />
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
          
          <button className="edit-profile-btn" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <><FaSave /> Save Profile</> : <><FaEdit /> Edit Profile</>}
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
               <button className="change-pass-btn">Change Password</button>
            </div>
          </div>
        </div>

        {/* NEW SEPARATE CONTAINERS AT THE BOTTOM */}
        <div className="profile-card social-media-container">
           <h3>Connect</h3>
           <div className="social-links-flex">
              <FaFacebook /> <FaTwitter /> <FaGithub />
           </div>
           
        </div>

        <div className="profile-card activity-logs-container">
           <h3><FaHistory /> Activity Logs</h3>
           <ul className="activity-log-list">
              <li>Profile Updated <small>Just now</small></li>
              <li>Logged in <small>2 hours ago</small></li>
           </ul>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;