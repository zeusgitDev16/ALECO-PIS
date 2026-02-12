import React from 'react'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';
import './CSS/BodyLandPage.css';
import CookieBanner from './components/CookieBanner.jsx';

function App() {
  
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
    </>

   );
}

export default App
