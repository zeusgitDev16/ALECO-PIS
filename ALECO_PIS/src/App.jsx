import React, { useState, useEffect } from 'react'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';
import './CSS/BodyLandPage.css';
import CookieBanner from './components/CookieBanner.jsx';
import DarkLightButton from './components/buttons/darkLightButton.jsx'; 

function App() {
  
  const [theme, setTheme] = useState(
    localStorage.getItem('app-theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

   return(
    <>
    <div className = "fix-container-nav">
      <LandingPage/>
      <Navbar/>
    </div>
    
    <div className = "body-padding">
      <InterruptionList/>
      <Footer/>
    </div>
    <CookieBanner/>

    {/* --- CHANGE THIS COMPONENT 👇 --- */}
    <DarkLightButton theme={theme} toggleTheme={toggleTheme} />
    </>
   );
}

export default App
