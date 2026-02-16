import React from 'react';
import '../CSS/AdminSidebar.css';
import alecoLogo from '../assets/Aleco-logo-modified.png'; 

const AdminSidebar = () => {
  return (
    <aside className="vertical-sidebar">
      {/* This checkbox controls the expand/collapse state using CSS.
        checked = Expanded
        unchecked = Collapsed
      */}
      <input type="checkbox" id="sidebar-toggle" className="checkbox-input" defaultChecked />
      
      <nav className="sidebar-nav">
        <header className="sidebar-header">
          {/* TOGGLE BUTTON */}
          <div className="sidebar__toggle-container">
            <label htmlFor="sidebar-toggle" className="nav__toggle" aria-label="Toggle Sidebar">
              <span className="toggle--icons">
                {/* Icon for when sidebar is CLOSED (Arrow Right) */}
                <i className="fas fa-arrow-right toggle-svg-icon toggle--close"></i>
                {/* Icon for when sidebar is OPEN (Arrow Left) */}
                <i className="fas fa-arrow-left toggle-svg-icon toggle--open"></i>
              </span>
            </label>
          </div>

          {/* LOGO & BRANDING */}
          <figure className="sidebar-brand">
            <img className="aleco-logo" src={alecoLogo} alt="ALECO Logo" />
            <figcaption className="brand-text">
              <p className="user-id">ALECO</p>
              <p className="user-role">Admin Portal</p>
            </figcaption>
          </figure>
        </header>

        <section className="sidebar__wrapper">
          {/* PRIMARY LIST */}
          <ul className="sidebar__list list--primary">
            <li className="sidebar__item item--heading">
              <h2 className="sidebar__item--heading">Overview</h2>
            </li>
            
            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Dashboard">
                <span className="icon"><i className="fas fa-chart-line"></i></span>
                <span className="text">Dashboard</span>
              </a>
            </li>
            
            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Incidents">
                <span className="icon"><i className="fas fa-exclamation-triangle"></i></span>
                <span className="text">Incidents</span>
              </a>
            </li>

            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Interruptions">
                <span className="icon"><i className="fas fa-bolt"></i></span>
                <span className="text">Interruptions</span>
              </a>
            </li>

            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Assets">
                <span className="icon"><i className="fas fa-folder-open"></i></span>
                <span className="text">Assets</span>
              </a>
            </li>
          </ul>

          {/* SECONDARY LIST */}
          <ul className="sidebar__list list--secondary">
            <li className="sidebar__item item--heading">
              <h2 className="sidebar__item--heading">System</h2>
            </li>
            
            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Profile">
                <span className="icon"><i className="fas fa-user-circle"></i></span>
                <span className="text">Profile</span>
              </a>
            </li>

            <li className="sidebar__item">
              <a className="sidebar__link" href="#" data-tooltip="Settings">
                <span className="icon"><i className="fas fa-cog"></i></span>
                <span className="text">Settings</span>
              </a>
            </li>

            <li className="sidebar__item">
              <a className="sidebar__link" href="/" data-tooltip="Logout">
                <span className="icon"><i className="fas fa-sign-out-alt"></i></span>
                <span className="text">Logout</span>
              </a>
            </li>
          </ul>
        </section>
      </nav>
    </aside>
  );
};

export default AdminSidebar;