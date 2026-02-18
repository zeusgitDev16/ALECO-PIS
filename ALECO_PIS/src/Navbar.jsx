import React from 'react';
import { Link } from 'react-router-dom';
import './CSS/Navbar.css';
import Login from'./components/buttons/login.jsx';
import logo from './assets/Aleco-logo-modified.png';

 
const Navbar = () => {

  
    const navItems = [
     {label: 'Visit us', to: '/visit-us'},
     {label: 'Report a problem', href: '#report'},
     {label: 'About', to: '/about'},
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
        <div className ="nav-links-container">
        <ul className="nav-links">
          {navItems.map((item, index) => (
            <li key={index}>
              {item.to ? (
                <Link to={item.to} className="nav-item">
                  {item.label}
                </Link>
              ) : (
                <a 
                  href={item.href} 
                  className="nav-item"
                  target={item.href && item.href.startsWith('http') ? "_blank" : undefined}
                  rel={item.href && item.href.startsWith('http') ? "noopener noreferrer" : undefined}
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
       <Login/> 
       </div>
      </div>
    </nav>
    </>
  );
}



export default Navbar