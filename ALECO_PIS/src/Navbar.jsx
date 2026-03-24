import React from 'react';
import './CSS/Navbar.css';
import Login from'./components/buttons/login.jsx';
import logo from './assets/Aleco-logo-modified.png';

/* Icons for compact view (max-width: 425px) - match SearchBarGlobal icon-btn style */
const NavIcons = {
  visit: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  ),
  report: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  about: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  ),
  privacy: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  ),
};

const handleNavClick = (e, href) => {
  if (!href.startsWith('#')) return;
  e.preventDefault();
  const id = href.slice(1);
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', href);
  }
};

const Navbar = () => {
  const navItems = [
    { label: 'Visit us', href: 'https://web.alecoinc.com.ph/', icon: 'visit' },
    { label: 'Report a problem', href: '#report', icon: 'report' },
    { label: 'About', href: '#about', icon: 'about' },
    { label: 'Privacy Notice', href: '#privacy', icon: 'privacy' },
  ];

  return (
    <>
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <a href="/" className="Aleco-Logo">
            <img src={logo} alt="ALECO Logo" className="logo-height" />
            <span className="Title">ALECO</span>
          </a>
        </div>

        <div className="nav-links-container">
          <ul className="nav-links">
            {navItems.map((item, index) => (
              <li key={index}>
                <a
                  href={item.href}
                  className="nav-item"
                  target={item.href.startsWith('http') ? '_blank' : undefined}
                  rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  title={item.label}
                  aria-label={item.label}
                  onClick={(e) => handleNavClick(e, item.href)}
                >
                  <span className="nav-item-text">{item.label}</span>
                  <span className="nav-item-icon">{NavIcons[item.icon]}</span>
                </a>
              </li>
            ))}
          </ul>
          <Login />
        </div>
      </div>
    </nav>
    </>
  );
}



export default Navbar