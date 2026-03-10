import React, { useState, useEffect } from 'react';
import '../../CSS/ProfilePage.css';

const ProfilePage = () => {
  const [userData, setUserData] = useState({
    name: localStorage.getItem('userName') || 'Aezy Millete',
    email: localStorage.getItem('userEmail') || '',
    role: (localStorage.getItem('userRole') || 'ADMIN').toLowerCase(),
    pic: localStorage.getItem('googleProfilePic') || ''
  });

  return (
    <div className="profile-main-container">
      <header className="profile-header-text">
        <h1>Profile</h1>
        <p>View and manage your account details here.</p>
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
            <h2>{userData.name}</h2>
            <span className={`role-pill ${userData.role}`}>{userData.role.toUpperCase()}</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Bio & Details */}
        <div className="profile-card details-card">
          <div className="details-header-row">
            <h3>Bio & other details</h3>
            <span className="online-indicator"></span>
          </div>

          <div className="info-details-grid">
            <div className="info-group">
              <label>My Role</label>
              <p>System Administrator</p>
            </div>
            <div className="info-group">
              <label>My Experience Level</label>
              <p>Intermediate</p>
            </div>
            <div className="info-group">
              <label>My Email</label>
              <p>{userData.email}</p>
            </div>
            <div className="info-group">
              <label>My City or Region</label>
              <p>Albay, Philippines</p>
            </div>
          </div>

          <div className="tags-section">
            <label>Tags</label>
            <div className="tags-flex">
              <span>#Technical</span> <span>#Dispatch</span> <span>#Admin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;