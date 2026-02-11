import React from 'react';
import './CSS/Navbar.css';
import Login from'./components/buttons/login.jsx';
import logo from './assets/Aleco-logo-modified.png';

 
const Navbar = () => {

    const navItems = [
     {label: 'Visit us', href: '#visit'},
     {label: 'Report a problem', href: '#report'},
     {label: 'About', href: '#about'},
     {label: 'Privacy Notice', href: '#privacy'},
    ];

   return (
    <>
    <nav className="navbar">
      <div className="nav-container">
        {/* Logo/Title */}
        <div className="nav-brand">
          <a href="/"className = "Aleco-Logo">
          <img 
           src={logo} 
           alt="ALECO Logo" 
           className="logo-height" /* Adjust height as needed */
                        />
          <span className="Title">ALECO
            </span>
           </a>
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
       <Login/> 
      </div>
    </nav>
    </>
  );
}



export default Navbar