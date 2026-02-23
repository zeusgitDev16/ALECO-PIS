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
import AdminDashboard from './Dashboard.jsx';
import About from './About.jsx';
import PrivacyNotice from './PrivacyNotice.jsx';
import AdminUsers from './components/Users.jsx';
import AdminTickets from './components/Tickets.jsx';
import AdminInterruptions from './components/Interruptions.jsx';
import AdminHistory from './components/History.jsx';

// --- NEW HELPER COMPONENT ---
// We put the UI logic here so it can "talk" to the Router
const NavigationWrapper = ({ theme, toggleTheme }) => {
  const location = useLocation();
  
  // This checks if we are currently looking at the admin dashboard
  const isAdminPage = location.pathname.startsWith('/admin-');

  return (
    <>
      <div className="fix-container-nav" style={{ position: 'sticky', top: 0, zIndex: 1100, backgroundColor: 'var(--bg-body)' }}>
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
        <Route path="/admin-users" element={<AdminUsers />} />
        <Route path="/admin-tickets" element={<AdminTickets />} />
        <Route path="/admin-interruptions" element={<AdminInterruptions />} />
        <Route path="/admin-history" element={<AdminHistory />} />
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
