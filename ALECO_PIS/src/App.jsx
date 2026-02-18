import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';
import './CSS/BodyLandPage.css';
import CookieBanner from './components/CookieBanner.jsx';
import DarkLightButton from './components/buttons/darkLightButton.jsx'; 
import ReportaProblem from './ReportaProblem.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import About from './About.jsx';
import PrivacyNotice from './PrivacyNotice.jsx';

// --- NEW HELPER COMPONENT ---
// We put the UI logic here so it can "talk" to the Router
const NavigationWrapper = ({ theme, toggleTheme }) => {
  const location = useLocation();
  
  // This checks if we are currently looking at the admin dashboard
  const isAdminPage = location.pathname === '/admin-dashboard';

  return (
    <>
      <div className="fix-container-nav">
        {/* LandingPage stays on every screen per your request */}
        <LandingPage />
        
        {/* Navbar only shows if we are NOT on the admin page */}
        {!isAdminPage && <Navbar />}
      </div>

      <Routes>
        {/* HOME ROUTE */}
        <Route path="/" element={
          <div className="body-padding">
            <InterruptionList />
            <ReportaProblem />
            <About />
            <PrivacyNotice />
            <Footer />
          </div>
        } />

        {/* ADMIN ROUTE */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>

      <CookieBanner />
      <DarkLightButton theme={theme} toggleTheme={toggleTheme} />
    </>
  );
};

// --- YOUR ORIGINAL FUNCTION ---
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

  return (
    <Router>
      {/* We call the wrapper inside the Router */}
      <NavigationWrapper theme={theme} toggleTheme={toggleTheme} />
    </Router>
  );
}

export default App;
