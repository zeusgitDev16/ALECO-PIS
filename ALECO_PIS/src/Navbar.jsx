import React from 'react';
import './Navbar.css';

 
const Navbar = () => {

    const navItems = [
     {label: 'Visit us', href: '#visit'},
     {label: 'Report a problem', href: '#report'},
     {label: 'About', href: '#about'},
     {label: 'Privacy Notice', href: '#privacy'},
    ];

   return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Logo/Title */}
        <div className="nav-brand">
          <a href="/">ALECO</a>
        </div>

        {/* Unordered List for Navigation */}
        <ul className="nav-links">
          {navItems.map((item, index) => (
            <li key={index}>
              <a href={item.href} className="nav-item">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}



export default Navbar